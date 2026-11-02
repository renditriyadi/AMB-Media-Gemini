// dola-generation.js - Dola AI (ByteDance) Generator Integration
// Dual-Engine: 100% Background API First + Smart Tab UI Automation Fallback (jika terkena WAF Shark Admin / Rate Limit / Slider Captcha).

import { getTodayLocalDateStr } from '../account/account-auth.js';

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// -----------------------------------------------------------------------------
// Format Prompt dengan Ratio di Ujung Prompt (misal: "prompt, 9:16")
// -----------------------------------------------------------------------------

// RATE LIMIT: Jalur direct API Dola dinonaktifkan sementara untuk menjaga akun.
// Kode API di bawah tetap dipertahankan agar dapat diaktifkan kembali saat diperlukan.
const ENABLE_DOLA_DIRECT_API = false;
export function formatDolaPromptWithRatio(rawPrompt, ratio) {
  let p = (rawPrompt || '').trim();
  if (!ratio) return p;
  const cleanRatio = String(ratio).trim();

  // Jika prompt sudah berakhiran ratio yang sama (misal: "..., 9:16" atau "... 9:16"), tidak perlu diduplikasi
  const ratioPattern = new RegExp(`[,\\s]+${cleanRatio.replace(':', '[:\\-]')}\\s*$`, 'i');
  if (ratioPattern.test(p)) {
    return p;
  }

  // Bersihkan tanda koma, titik koma, titik, atau spasi di ujung prompt
  p = p.replace(/[,;.\s]+$/, '');
  return `${p}, ${cleanRatio}`;
}

// -----------------------------------------------------------------------------
// CRC32 & Web Crypto AWS4 Signing (Direct Cloud Upload ke ByteDance TOS & ImageX)
// -----------------------------------------------------------------------------

function makeCrcTable() {
  const cTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    cTable[n] = c;
  }
  return cTable;
}

const CRC_TABLE = makeCrcTable();

function calculateCrc32Hex(uint8Array) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < uint8Array.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ uint8Array[i]) & 0xFF];
  }
  const res = (crc ^ (-1)) >>> 0;
  return res.toString(16).padStart(8, '0');
}

async function hmacSha256(keyBytes, messageBytes) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
  return new Uint8Array(signature);
}

async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const enc = new TextEncoder();
  const kDate = await hmacSha256(enc.encode(`AWS4${key}`), enc.encode(dateStamp));
  const kRegion = await hmacSha256(kDate, enc.encode(regionName));
  const kService = await hmacSha256(kRegion, enc.encode(serviceName));
  const kSigning = await hmacSha256(kService, enc.encode('aws4_request'));
  return kSigning;
}

async function awsV4Auth({
  method,
  host,
  path = '/',
  queryParams = {},
  headersToSign = {},
  payloadBytes = new Uint8Array(0),
  accessKey,
  secretKey,
  region = 'us-east-1',
  service = 'imagex',
}) {
  const enc = new TextEncoder();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const headers = {};
  for (const [k, v] of Object.entries(headersToSign)) {
    headers[k.toLowerCase()] = String(v).trim();
  }
  headers['x-amz-date'] = amzDate;

  const sortedHeaderKeys = Object.keys(headers).sort();
  const signedHeadersStr = sortedHeaderKeys.join(';');
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join('');

  const sortedQueryKeys = Object.keys(queryParams).sort();
  const canonicalQueryString = sortedQueryKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const payloadHash = await sha256Hex(payloadBytes);
  const canonicalRequest = `${method}\n${path}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeadersStr}\n${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalReqHash = await sha256Hex(enc.encode(canonicalRequest));
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalReqHash}`;

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signatureBytes = await hmacSha256(signingKey, enc.encode(stringToSign));
  const signature = Array.from(signatureBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const authHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;
  return { authHeader, amzDate, dateStamp };
}

// -----------------------------------------------------------------------------
// Helper Konversi & Upload Reference Image ke ByteDance ImageX / TOS (Background)
// -----------------------------------------------------------------------------

async function assetToBytes(asset) {
  const nestedAsset = asset?.weavyAsset || asset?.asset || asset;
  const src = asset?.dataUrl || asset?.base64 || asset?.asset?.dataUrl || nestedAsset?.dataUrl || nestedAsset?.base64 || nestedAsset?.url || nestedAsset?.downloadUrl || nestedAsset?.thumbnailUrl || asset?.url || asset?.thumbnailUrl;
  let filename = asset?.name || asset?.asset?.name || asset?.weavyAsset?.name || 'reference.jpg';
  let mime = 'image/jpeg';
  let ext = '.jpg';

  if (typeof src === 'string' && src.startsWith('data:')) {
    const parts = src.split(',');
    mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
    const binary = atob(parts[1]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { bytes, mime, ext, filename, dataUrl: src };
  }

  if (typeof src === 'string' && src.startsWith('http')) {
    const res = await fetch(src);
    const buf = await res.arrayBuffer();
    mime = res.headers.get('content-type') || 'image/jpeg';
    ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
    return { bytes: new Uint8Array(buf), mime, ext, filename, dataUrl: src };
  }

  throw new Error('Format gambar referensi tidak valid.');
}

function bytesToDataUrl(bytes, mime = 'image/jpeg') {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function ensureImageFilename(filename, ext = '.jpg', mime = 'image/jpeg') {
  const normalizedExt = ext || (mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg');
  const safeName = String(filename || 'reference').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'reference';
  return /\.(jpe?g|png|webp)$/i.test(safeName) ? safeName : `${safeName}${normalizedExt}`;
}

export async function uploadDolaReferenceImage(asset) {
  const { bytes, ext, filename } = await assetToBytes(asset);
  const fileSize = bytes.length;

  console.log('[weavy-dola] Memulai background upload gambar ke ByteDance ImageX:', { filename, fileSize, ext });

  const prepUrl = 'https://www.dola.com/alice/resource/prepare_upload?version_code=20800&language=en&device_platform=web&doubao_device_platform=web&aid=495671&real_aid=495671&pkg_type=release_version&region=ID&sys_region=ID&samantha_web=1&web_platform=browser';
  const prepRes = await fetch(prepUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'agw-js-conv': 'str',
      'Accept': 'application/json, text/plain, */*',
    },
    body: JSON.stringify({ tenant_id: '5', scene_id: '4', resource_type: 2 }),
  });

  if (!prepRes.ok) {
    throw new Error(`Gagal prepare_upload Dola (HTTP ${prepRes.status}).`);
  }

  const prepData = await prepRes.json();
  if (prepData?.code !== 0 || !prepData?.data?.upload_auth_token) {
    throw new Error(`Dola prepare_upload ditolak: ${prepData?.msg || JSON.stringify(prepData)}`);
  }

  const { service_id, upload_host, upload_auth_token } = prepData.data;
  const { access_key, secret_key, session_token } = upload_auth_token;

  const seed = `weavy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const applyQuery = {
    Action: 'ApplyImageUpload',
    Version: '2018-08-01',
    ServiceId: service_id,
    FileSize: String(fileSize),
    FileExtension: ext,
    s: seed,
  };

  const { authHeader: applyAuth, amzDate: applyDate } = await awsV4Auth({
    method: 'GET',
    host: upload_host,
    path: '/',
    queryParams: applyQuery,
    headersToSign: { 'x-amz-security-token': session_token },
    accessKey: access_key,
    secretKey: secret_key,
  });

  const applyQueryStr = Object.keys(applyQuery)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(applyQuery[k])}`)
    .join('&');

  const applyRes = await fetch(`https://${upload_host}/?${applyQueryStr}`, {
    method: 'GET',
    headers: {
      'x-amz-security-token': session_token,
      'x-amz-date': applyDate,
      'Authorization': applyAuth,
    },
  });

  if (!applyRes.ok) {
    throw new Error(`Gagal ApplyImageUpload ImageX (HTTP ${applyRes.status})`);
  }

  const applyData = await applyRes.json();
  const uploadAddress = applyData?.Result?.UploadAddress;
  if (!uploadAddress || !uploadAddress.StoreInfos?.[0]) {
    throw new Error(`Invalid UploadAddress dari ImageX: ${JSON.stringify(applyData)}`);
  }

  const storeInfo = uploadAddress.StoreInfos[0];
  const storeUri = storeInfo.StoreUri;
  const tosAuth = storeInfo.Auth;
  const sessionKey = uploadAddress.SessionKey;
  const uploadHosts = uploadAddress.UploadHosts || [];
  const targetUploadHost = uploadHosts[0] || 'tos-mya-share.vodupload.com';

  const crcHex = calculateCrc32Hex(bytes);
  const putUrl = `https://${targetUploadHost}/${storeUri}`;
  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      'Authorization': tosAuth,
      'Content-Type': 'application/octet-stream',
      'Content-CRC32': crcHex,
    },
    body: bytes,
  });

  if (!putRes.ok) {
    throw new Error(`Gagal upload file binary ke TOS (HTTP ${putRes.status})`);
  }

  const commitQuery = {
    Action: 'CommitImageUpload',
    Version: '2018-08-01',
    ServiceId: service_id,
  };
  const commitBody = JSON.stringify({
    SessionKey: sessionKey,
    Option: { ReportInfo: true },
  });
  const commitBodyBytes = new TextEncoder().encode(commitBody);

  const { authHeader: commitAuth, amzDate: commitDate } = await awsV4Auth({
    method: 'POST',
    host: upload_host,
    path: '/',
    queryParams: commitQuery,
    headersToSign: {
      'x-amz-security-token': session_token,
      'content-type': 'application/json',
    },
    payloadBytes: commitBodyBytes,
    accessKey: access_key,
    secretKey: secret_key,
  });

  const commitQueryStr = Object.keys(commitQuery)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(commitQuery[k])}`)
    .join('&');

  const commitRes = await fetch(`https://${upload_host}/?${commitQueryStr}`, {
    method: 'POST',
    headers: {
      'x-amz-security-token': session_token,
      'x-amz-date': commitDate,
      'Authorization': commitAuth,
      'Content-Type': 'application/json',
    },
    body: commitBody,
  });

  if (!commitRes.ok) {
    throw new Error(`Gagal CommitImageUpload ImageX (HTTP ${commitRes.status})`);
  }

  const commitData = await commitRes.json();
  const finalUri = commitData?.Result?.Results?.[0]?.Uri || storeUri;
  const pluginRes = commitData?.Result?.PluginResult?.[0] || {};
  const width = pluginRes?.ImageWidth || 1920;
  const height = pluginRes?.ImageHeight || 1080;
  const format = pluginRes?.ImageFormat || ext.replace('.', '') || 'jpg';

  console.log('[weavy-dola] ✅ Sukses upload gambar referensi ke TOS:', {
    uri: finalUri,
    width,
    height,
    format,
  });

  return {
    uri: finalUri,
    name: filename,
    width,
    height,
    format,
  };
}
export async function readDolaReferenceFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file?.type?.startsWith('image/'));
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `dola_ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      base64: reader.result,
      dataUrl: reader.result,
      asset: {
        name: file.name,
        dataUrl: reader.result,
      },
      isUploading: false,
      showCheckmark: true,
      error: null,
    });
    reader.onerror = () => reject(new Error(`File reference ${file.name} gagal dibaca.`));
    reader.readAsDataURL(file);
  })));
}

// -----------------------------------------------------------------------------
// Dola Cookies & Context Reader
// -----------------------------------------------------------------------------

async function getDolaBrowserContext() {
  const ctx = {
    fp: 'verify_mtv6b80j_85FNAJ26_dnDl_4nF4_9Irb_wEYBAAVqnN5b',
    tea_uuid: '7661162267439269383',
    web_id: '7661162267439269383',
    deviceId: '7653388158268196405',
    msToken: '',
    csrfToken: '',
  };

  if (typeof chrome !== 'undefined' && chrome.cookies && chrome.cookies.getAll) {
    try {
      const cookies = await chrome.cookies.getAll({ domain: 'dola.com' });
      for (const c of cookies) {
        if (c.name === 's_v_web_id' && c.value) ctx.fp = c.value;
        if ((c.name === 'tea_uuid' || c.name === 'web_id') && c.value) {
          ctx.tea_uuid = c.value;
          ctx.web_id = c.value;
        }
        if (c.name === 'device_id' && c.value) ctx.deviceId = c.value;
        if (c.name === 'msToken' && c.value) ctx.msToken = c.value;
        if (c.name === 'passport_csrf_token' && c.value) ctx.csrfToken = c.value;
      }
    } catch (e) {
      console.warn('[weavy-dola] chrome.cookies.getAll error:', e);
    }
  }

  return ctx;
}

// -----------------------------------------------------------------------------
// Eksekusi /chat/completion Murni Background
// -----------------------------------------------------------------------------

async function sendDolaBackgroundCompletion({
  prompt,
  ratio = '9:16',
  duration = 10,
  uploadedRefImages = [],
  isVideo = true,
  model = 'seedance_v2.5',
}) {
  const browserCtx = await getDolaBrowserContext();

  const url = new URL('https://www.dola.com/chat/completion');
  url.searchParams.set('aid', '495671');
  url.searchParams.set('real_aid', '495671');
  url.searchParams.set('device_platform', 'web');
  url.searchParams.set('doubao_device_platform', 'web');
  url.searchParams.set('doubao_pc_version', '3.38.0');
  url.searchParams.set('pc_version', '3.38.0');
  url.searchParams.set('pkg_type', 'release_version');
  url.searchParams.set('region', 'ID');
  url.searchParams.set('sys_region', 'ID');
  url.searchParams.set('language', 'en');
  url.searchParams.set('samantha_web', '1');
  url.searchParams.set('use-olympus-account', '1');
  url.searchParams.set('version_code', '20800');
  url.searchParams.set('web_platform', 'browser');
  url.searchParams.set('tz_name', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta');

  if (browserCtx.fp) url.searchParams.set('fp', browserCtx.fp);
  if (browserCtx.tea_uuid) url.searchParams.set('tea_uuid', browserCtx.tea_uuid);
  if (browserCtx.web_id) url.searchParams.set('web_id', browserCtx.web_id);
  if (browserCtx.deviceId) url.searchParams.set('device_id', browserCtx.deviceId);
  if (browserCtx.msToken) url.searchParams.set('msToken', browserCtx.msToken);

  const webTabId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  url.searchParams.set('web_tab_id', webTabId);

  const localConvId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const messages = [];

  if (uploadedRefImages && uploadedRefImages.length > 0) {
    const attachments = uploadedRefImages.map((ref, idx) => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `att_${Date.now()}_${idx}`;
      return {
        type: 1,
        identifier: id,
        image: {
          name: ref.name || `ref_${idx + 1}.jpg`,
          uri: ref.uri,
          image_ori: {
            url: '',
            width: ref.width || 1920,
            height: ref.height || 1080,
            format: ref.format || 'jpg',
            url_formats: {},
          },
        },
        parse_state: 0,
        review_state: 1,
        upload_status: 1,
        progress: 100,
        src: '',
      };
    });

    messages.push({
      local_message_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg_att_${Date.now()}`,
      content_block: [
        {
          block_type: 10052,
          content: {
            attachment_block: { attachments },
            pc_event_block: '',
          },
          block_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `blk_att_${Date.now()}`,
          parent_id: '',
          meta_info: [],
          append_fields: [],
        },
      ],
      message_status: 0,
    });
  }

  const promptText = isVideo
    ? `Generated video: ${prompt.trim()}, ${ratio}`
    : prompt.trim();

  messages.push({
    local_message_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg_txt_${Date.now()}`,
    content_block: [
      {
        block_type: 10000,
        content: {
          text_block: {
            text: promptText,
            icon_url: '',
            icon_url_dark: '',
            summary: '',
          },
          pc_event_block: '',
        },
        block_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `blk_txt_${Date.now()}`,
        parent_id: '',
        meta_info: [],
        append_fields: [],
      },
    ],
    message_status: 0,
  });

  const isPro = String(model || '').toLowerCase().includes('pro') ||
    String(model || '').toLowerCase().includes('2.5') ||
    String(model || '').toLowerCase().includes('5.0') ||
    String(model || '').toLowerCase().includes('5');

  const selectedModelKey = isVideo
    ? (isPro ? 'seedance_v2.5' : (String(model || '').includes('1.0') ? 'seedance_v1.0' : 'seedance_v2.0_fast'))
    : (isPro ? 'pro' : 'general');

  // Di Dola Pro Mode gambar, chat_ability WAJIB null karena Dola Pro tidak menggunakan plugin/skill 3 Fast
  const chatAbility = isVideo
    ? {
      ability_type: 17,
      ability_param: JSON.stringify({
        ratio,
        model: selectedModelKey,
        duration,
        input_box_content: {
          user_input_content: prompt.trim(),
          reply_message_format: 'Generated video: %s',
        },
      }),
    }
    : (isPro
      ? null
      : {
        ability_type: 3,
        ability_param: JSON.stringify({
          ratio,
          model: selectedModelKey,
          input_box_content: {
            user_input_content: prompt.trim(),
            reply_message_format: 'Generated image: %s',
          },
        }),
      });

  const payload = {
    client_meta: {
      local_conversation_id: localConvId,
      conversation_id: '',
      bot_id: '7339470689562525703',
      last_section_id: '',
      last_message_index: null,
      local_permissions: [
        { permission_name: 'ACCESS_COARSE_LOCATION', status: 3 },
        { permission_name: 'ACCESS_FINE_LOCATION', status: 3 },
        { permission_name: 'ACCESS_BACKGROUND_LOCATION', status: 3 },
      ],
    },
    messages,
    option: {
      send_message_scene: '',
      create_time_ms: Date.now(),
      collect_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `col_${Date.now()}`,
      is_audio: false,
      answer_with_suggest: false,
      tts_switch: false,
      need_deep_think: 0,
      click_clear_context: false,
      from_suggest: false,
      is_regen: false,
      is_replace: false,
      is_from_click_option: false,
      is_from_click_softlink: false,
      disable_sse_cache: false,
      select_text_action: '',
      is_select_text: false,
      resend_for_regen: false,
      scene_type: 0,
      unique_key: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `uk_${Date.now()}`,
      start_seq: 0,
      need_create_conversation: true,
      conversation_init_option: { need_ack_conversation: true },
      regen_query_id: [],
      edit_query_id: [],
      regen_instruction: '',
      no_replace_for_regen: false,
      message_from: 0,
      shared_app_name: '',
      shared_app_id: '',
      sse_recv_event_options: { support_chunk_delta: true },
      support_lazy_fetch_stream: true,
      is_ai_playground: false,
      is_old_user: false,
      recovery_option: {
        is_recovery: false,
        req_create_time_sec: Math.floor(Date.now() / 1000),
        append_sse_event_scene: 0,
      },
      message_storage_type: 0,
      related_deleted_message_ids: {},
      connector_info_list: [],
      model_config: { model_item_key: selectedModelKey, model_extra_params: {} },
      aggregate_params: {
        mention_skill_list: '[]',
        mention_plugin_list: '[]',
        mention_ext: '[{}]',
        conversation_mode: isPro ? 'pro' : 'fast',
        mode_id: isPro ? 'pro' : 'fast',
        model_item_key: selectedModelKey,
        agent_mode: '',
        reasoning_effort: '',
        provider_id: '',
      },
    },
    chat_ability: chatAbility,
    user_context: [],
    ext: {
      answer_with_suggest: '0',
      sub_conv_firstmet_type: '1',
      collection_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cid_${Date.now()}`,
      is_finish: '1',
      conversation_init_option: '{"need_ack_conversation":true}',
      commerce_credit_config_enable: '0',
    },
  };

  console.log('[weavy-dola] Mengirim POST /chat/completion 100% Background:', {
    url: url.toString(),
    prompt: prompt.slice(0, 80),
    ratio,
    isVideo,
    refImagesCount: uploadedRefImages.length,
  });

  let serverConvId = null;
  let serverRemainingCredit = null;
  let wafRateLimitDetected = false;
  let wafErrorText = '';

  // 1. Eksekusi melalui Tab Context Bridge jika tab Dola tersedia (100% lolos WAF ByteDance)
  try {
    const { tab } = await getOrOpenDolaTab().catch(() => ({ tab: null }));
    if (tab?.id) {
      const streamId = `bg_comp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const bridgeResult = await new Promise((resolve) => {
        let convFound = null;
        let creditFound = null;
        let chunkCount = 0;

        const onMsg = (msg) => {
          if (!msg || msg.streamId !== streamId) return;
          if (msg.action === 'STREAM_CHUNK' && msg.chunk) {
            chunkCount++;
            const t = msg.chunk;
            if (t.includes('STREAM_ERROR') || t.includes('710022004') || t.includes('shark_admin') || t.includes('"subtype":"slide"')) {
              wafRateLimitDetected = true;
              wafErrorText = t;
            }
            const cm = t.match(/"conversation_id"\s*:\s*"(\d+)"/) || t.match(/"conv_id"\s*:\s*"(\d+)"/);
            if (cm && cm[1]) convFound = cm[1];
            const crm = t.match(/"(?:remain_credit|left_credit|credit|quota|remaining_credit)"\s*:\s*(\d+)/i);
            if (crm) creditFound = parseInt(crm[1], 10);

            if (convFound || chunkCount > 20) {
              chrome.runtime.onMessage.removeListener(onMsg);
              resolve({ convId: convFound, credit: creditFound });
            }
          } else if (msg.action === 'STREAM_DONE' || msg.action === 'STREAM_ERROR') {
            chrome.runtime.onMessage.removeListener(onMsg);
            resolve({ convId: convFound, credit: creditFound });
          }
        };

        chrome.runtime.onMessage.addListener(onMsg);
        setTimeout(() => {
          chrome.runtime.onMessage.removeListener(onMsg);
          resolve({ convId: convFound, credit: creditFound });
        }, 12000);

        executeTabContextStreamFetch(tab.id, streamId, url.toString(), payload).catch(() => {
          chrome.runtime.onMessage.removeListener(onMsg);
          resolve({ convId: null, credit: null });
        });
      });

      if (bridgeResult?.convId) {
        serverConvId = bridgeResult.convId;
        serverRemainingCredit = bridgeResult.credit;
        console.log('[weavy-dola] ✅ Tab Context Bridge berhasil memproses background task:', serverConvId);
      }
    }
  } catch (tabBridgeErr) {
    console.warn('[weavy-dola] Tab bridge completion gagal, mencoba direct fetch:', tabBridgeErr);
  }

  // 2. Direct fetch jika tab bridge belum mendapatkan convId
  if (!serverConvId && !wafRateLimitDetected) {
    const response = await fetch(url.toString(), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'agw-js-conv': 'str, str',
        'Origin': 'https://www.dola.com',
        'Referer': 'https://www.dola.com/',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Dola /chat/completion gagal (HTTP ${response.status}).`);
    }

    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let readCount = 0;

      while (readCount < 25) {
        const { value, done } = await reader.read();
        if (done) break;
        readCount += 1;
        const text = decoder.decode(value, { stream: true });

        // Deteksi proteksi WAF Shark Admin / Rate Limit / Slider Captcha (Error 710022004)
        if (
          text.includes('STREAM_ERROR') ||
          text.includes('710022004') ||
          text.includes('shark_admin') ||
          text.includes('"subtype":"slide"') ||
          text.includes('rate limited')
        ) {
          wafRateLimitDetected = true;
          wafErrorText = text;
          console.warn('[weavy-dola] Terdeteksi WAF Shark Admin / Slider Captcha pada background completion:', text);
          break;
        }

        const convMatch = text.match(/"conversation_id"\s*:\s*"(\d+)"/) || text.match(/"conv_id"\s*:\s*"(\d+)"/);
        if (convMatch && convMatch[1]) {
          serverConvId = convMatch[1];
          console.log('[weavy-dola] ✅ Menemukan ID percakapan dari stream Dola:', serverConvId);
        }

        const creditMatch = text.match(/"(?:remain_credit|left_credit|credit|quota|remaining_credit)"\s*:\s*(\d+)/i);
        if (creditMatch) {
          serverRemainingCredit = parseInt(creditMatch[1], 10);
        }

        if (serverConvId) {
          break;
        }
      }
    } catch (e) {
      console.warn('[weavy-dola] stream read notice:', e);
    }
  }

  // Jika terdeteksi WAF Shark Admin / Slide Captcha, lempar error khusus untuk memicu Fallback UI Tab
  if (wafRateLimitDetected) {
    const err = new Error('DOLA_WAF_RATE_LIMIT');
    err.code = 710022004;
    err.details = wafErrorText;
    throw err;
  }

  return {
    localConvId,
    serverConvId,
    remainingCredit: serverRemainingCredit,
    startTimeSec: Math.floor(Date.now() / 1000),
  };
}

// -----------------------------------------------------------------------------
// Ekstraksi URL Video 1080p & Gambar Tanpa Watermark dari CDN ByteDance ImageX
// -----------------------------------------------------------------------------

export function cleanByteDanceCdnImageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const cleanUrl = url.trim();

  // Jika URL ByteDance menggunakan cryptographic signature (x-signature / sig / rk3s),
  // jangan ubah path atau parameter query karena akan merusak tanda tangan HMAC dan memicu HTTP 403 (gambar rusak)
  if (cleanUrl.includes('x-signature=') || cleanUrl.includes('sig=') || cleanUrl.includes('rk3s=')) {
    return cleanUrl;
  }

  let modUrl = cleanUrl;
  // Untuk URL statis / un-signed
  if (modUrl.includes('&lr=cici_ai')) {
    modUrl = modUrl.replace(/&lr=cici_ai/g, '&lr=unwatermarked');
  }
  if (modUrl.includes('?lr=cici_ai')) {
    modUrl = modUrl.replace(/\?lr=cici_ai/g, '?lr=unwatermarked');
  }

  return modUrl;
}

export function extractUnwatermarkedDolaVideoUrl(videoObj) {
  if (!videoObj) return null;

  const videoModelRaw = videoObj.video_model;
  if (videoModelRaw) {
    try {
      const vm = typeof videoModelRaw === 'string' ? JSON.parse(videoModelRaw) : videoModelRaw;
      const videoList = vm.video_list || {};
      const targetVideo = videoList.video_1 || Object.values(videoList)[0];
      if (targetVideo?.main_url) {
        try {
          const decoded = atob(targetVideo.main_url);
          if (decoded && decoded.startsWith('http')) {
            console.log('[weavy-dola] ✅ Berhasil decode direct unwatermarked 1080p CDN URL:', decoded.slice(0, 100));
            return decoded;
          }
        } catch (_) {}
      }
      if (targetVideo?.backup_url_1) {
        try {
          const decoded = atob(targetVideo.backup_url_1);
          if (decoded && decoded.startsWith('http')) return decoded;
        } catch (_) {}
      }
    } catch (_) {}
  }

  if (videoObj.download_url) {
    return videoObj.download_url.replace('&lr=cici_ai', '&lr=unwatermarked');
  }

  return null;
}

export function extractDolaImageUrl(imageObj) {
  if (!imageObj) return null;

  let candidateUrl = null;

  // 1. Cek prioritas sumber gambar original / unwatermarked dari payload ByteDance
  if (imageObj.image_ori?.url) {
    candidateUrl = imageObj.image_ori.url;
  } else if (imageObj.origin_image?.url) {
    candidateUrl = imageObj.origin_image.url;
  } else if (imageObj.download_url) {
    candidateUrl = imageObj.download_url;
  } else if (imageObj.download_img?.url) {
    candidateUrl = imageObj.download_img.url;
  } else if (imageObj.raw_image?.url) {
    candidateUrl = imageObj.raw_image.url;
  } else if (imageObj.large_img?.url) {
    candidateUrl = imageObj.large_img.url;
  } else if (Array.isArray(imageObj.image_ori?.url_list) && imageObj.image_ori.url_list[0]) {
    candidateUrl = imageObj.image_ori.url_list[0];
  } else if (Array.isArray(imageObj.origin_image?.url_list) && imageObj.origin_image.url_list[0]) {
    candidateUrl = imageObj.origin_image.url_list[0];
  } else if (Array.isArray(imageObj.url_list) && imageObj.url_list[0]) {
    candidateUrl = imageObj.url_list[0];
  } else if (imageObj.preview_img?.url) {
    candidateUrl = imageObj.preview_img.url;
  } else if (imageObj.image_thumb?.url) {
    candidateUrl = imageObj.image_thumb.url;
  } else if (typeof imageObj === 'string' && imageObj.startsWith('http')) {
    candidateUrl = imageObj;
  }

  if (!candidateUrl) return null;

  return cleanByteDanceCdnImageUrl(candidateUrl);
}

// -----------------------------------------------------------------------------
// Polling Background Endpoint /im/chain/recent_conv
// -----------------------------------------------------------------------------

async function pollRecentConv({ targetConvId, startSec, isVideo = true }) {
  const pollUrl = 'https://www.dola.com/im/chain/recent_conv?version_code=20800&language=en&device_platform=web&doubao_device_platform=web&aid=495671&real_aid=495671&pkg_type=release_version&region=ID&sys_region=ID&samantha_web=1&web_platform=browser';
  const pollBody = {
    cmd: 3200,
    uplink_body: {
      pull_recent_conv_chain_uplink_body: {
        limit: 5,
        filter: { conversation_type: [], project_filter: 1 },
        message_count_per_conv: 6,
        api_version: 1,
        conv_version: 0,
        direction: 3,
        option: {
          not_need_message: false,
          need_complete_conversation: true,
          need_coco_bot: true,
          need_pc_pin_chain: true,
          pc_pin_query_type: 1,
          exclude_archive: true,
          only_archive: false,
        },
      },
    },
    sequence_id: `seq_${Date.now()}`,
    channel: 2,
    version: '1',
  };

  const resp = await fetch(pollUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json; encoding=utf-8',
      'agw-js-conv': 'str',
      'Accept': '*/*',
    },
    body: JSON.stringify(pollBody),
  });

  if (!resp.ok) return { status: 'error', code: resp.status };

  const data = await resp.json();
  const cells = data?.downlink_body?.pull_recent_conv_chain_downlink_body?.cells || [];

  for (const c of cells) {
    const conv = c.conversation || {};
    const convId = String(conv.conversation_id || '');
    const convCreateTime = conv.create_time || 0;

    // JIKA targetConvId ada: WAJIB HANYA COCOKKAN Chat ID INI (agar tidak ketuker antar chat)
    if (targetConvId && convId !== String(targetConvId)) continue;
    // JIKA targetConvId belum ada: hanya ambil percakapan yang dibuat saat task ini dimulai
    if (!targetConvId && convCreateTime < (startSec - 5)) continue;

    for (const m of conv.messages || []) {
      const mTime = m.create_time || 0;
      if (mTime < (startSec - 5)) continue;

      const content = m.content || '';
      if (content.includes('creation_block')) {
        try {
          const parsed = JSON.parse(content);
          for (const b of parsed) {
            if (b.block_type === 2074 || b.block_type === 10052) {
              const creations = b.content?.creation_block?.creations || [];
              const remainCredit = b.content?.creation_block?.remain_credit ?? b.content?.creation_block?.left_credit ?? null;
              for (const cr of creations) {
                if (isVideo && cr.video) {
                  const v = cr.video;
                  if (v.status === 1 || v.status === 2) {
                    return { status: 'rendering', convId };
                  }
                  return { status: 'completed', videoObj: v, convId, remainingCredit: cr.remain_credit ?? remainCredit };
                }
                if (!isVideo && (cr.image || cr.image_ori || cr.origin_image)) {
                  const img = cr.image_ori || cr.origin_image || cr.image;
                  return { status: 'completed', imageObj: img, convId, remainingCredit: cr.remain_credit ?? remainCredit };
                }
              }
            }
          }
        } catch (_) {}
      }
    }
  }

  return { status: 'pending' };
}

// -----------------------------------------------------------------------------
// TAB AUTOMATION RUNNER (Fallback Cerdas jika Terkena WAF Shark / Slider)
// Re-use tab Dola yang sudah ada jika terbuka agar tidak membuka banyak tab baru.
// -----------------------------------------------------------------------------

async function executeInDolaTab(tabId, func, args = [], world = 'ISOLATED') {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await chrome.scripting.executeScript({
        target: { tabId },
        func,
        args,
        world,
      });
    } catch (error) {
      const message = String(error?.message || error);
      const transientFrameError = /Frame with ID \d+ was removed|Cannot access contents of the page/i.test(message);
      if (!transientFrameError || attempt === 1) throw error;
      console.warn('[weavy-dola] Tab executeScript retry:', message);
      await wait(500);
    }
  }
  throw new Error('Script otomatisasi tab Dola gagal dieksekusi.');
}

/**
 * Menjalankan streaming fetch langsung di dalam konteks tab Dola menggunakan chrome.scripting.executeScript.
 * Metode ini 100% kebal terhadap error "Could not establish connection. Receiving end does not exist"
 * karena mengeksekusi langsung di tab tanpa bergantung pada content script yang sudah berjalan sebelumnya.
 */
async function executeTabContextStreamFetch(tabId, streamId, urlStr, payload) {
  return await chrome.scripting.executeScript({
    target: { tabId },
    args: [{ streamId, urlStr, payload }],
    func: async ({ streamId, urlStr, payload }) => {
      try {
        const response = await fetch(urlStr, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Accept': '*/*',
            'Content-Type': 'application/json',
            'agw-js-conv': 'str, str',
            'Origin': 'https://www.dola.com',
            'Referer': 'https://www.dola.com/',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errTxt = await response.text().catch(() => '');
          chrome.runtime.sendMessage({
            action: 'STREAM_ERROR',
            streamId,
            error: `HTTP ${response.status}: ${errTxt.slice(0, 150)}`,
          });
          return;
        }

        if (!response.body) {
          chrome.runtime.sendMessage({
            action: 'STREAM_ERROR',
            streamId,
            error: 'Response body is empty',
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            chrome.runtime.sendMessage({ action: 'STREAM_DONE', streamId });
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            chrome.runtime.sendMessage({ action: 'STREAM_CHUNK', streamId, chunk });
          }
        }
      } catch (err) {
        chrome.runtime.sendMessage({
          action: 'STREAM_ERROR',
          streamId,
          error: err?.message || String(err),
        });
      }
    },
  });
}

async function waitForDolaTabReady(tabId, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await executeInDolaTab(tabId, () => {
        const input = document.querySelector(
          'div.tiptap.ProseMirror, #input-engine-container [contenteditable="true"], [data-chat-input], textarea, [contenteditable="true"]'
        );
        const modeTrigger = document.querySelector('[data-valid-btn="mode-select-action-btn"]') ||
          document.querySelector('[data-slot="dropdown-menu-trigger"]') ||
          document.querySelector('[data-input-engine-action-source="actionbar"] [aria-haspopup="menu"]');
        return {
          ready: document.readyState === 'complete' && !!input,
          readyState: document.readyState,
          hasInput: !!input,
          hasModeTrigger: !!modeTrigger,
        };
      });
      if (result?.[0]?.result?.ready) return result[0].result;
    } catch (_) {}
    await wait(400);
  }
  throw new Error('Tab Dola belum siap. Pastikan akun Dola sudah login di tab background.');
}

async function getOrOpenDolaTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    throw new Error('Chrome tabs API tidak tersedia.');
  }

  // 1. Cek apakah pengguna sudah memiliki tab Dola yang sedang aktif / terbuka di background
  const existingTabs = await chrome.tabs.query({ url: ['*://*.dola.com/*', '*://dola.com/*'] });
  if (existingTabs && existingTabs.length > 0) {
    const chatTabs = existingTabs
      .filter((tab) => tab.url?.includes('/chat'))
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    for (const existing of chatTabs) {
      try {
        await waitForDolaTabReady(existing.id, 6000);
        console.log('[weavy-dola] ♻️ Menggunakan tab Dola siap di background:', existing.id, existing.url);
        // Jangan ubah active tab agar pengguna tetap fokus di tab/layar aktif saat ini
        return { tab: existing, isNew: false };
      } catch (readyError) {
        console.warn('[weavy-dola] Tab Dola dilewati karena belum siap:', existing.id, readyError.message);
      }
    }
  }

  // 2. Jika belum ada tab Dola sama sekali, buka tab secara tersembunyi di background (active: false)
  console.log('[weavy-dola] Membuka tab Dola di background (tanpa memindahkan fokus)...');
  const newTab = await chrome.tabs.create({
    url: 'https://www.dola.com/chat',
    active: false,
  });

  // Tunggu tab selesai dimuat
  await new Promise((resolve) => {
    const listener = (tabId, info) => {
      if (tabId === newTab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 12000);
  });

  await waitForDolaTabReady(newTab.id, 25000);
  return { tab: newTab, isNew: true };
}

function findDolaModeTriggerFromDom(doc = document) {
  return (
    doc.querySelector('[data-valid-btn="mode-select-action-btn"]') ||
    doc.querySelector('[data-slot="dropdown-menu-trigger"]') ||
    doc.querySelector('[data-input-engine-action-source="actionbar"] [aria-haspopup="menu"]') ||
    doc.querySelector('[data-testid="mode-select-btn"]') ||
    Array.from(doc.querySelectorAll('button, [role="button"], [data-slot="dropdown-menu-trigger"], [aria-haspopup="menu"]')).find((el) => {
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return (text === 'fast' || text === 'pro' || text.startsWith('fast') || text.startsWith('pro')) && !text.includes('create');
    })
  );
}

function findDolaModeMenuItemFromDom(doc = document, isTargetPro = false) {
  const menuItems = Array.from(doc.querySelectorAll(
    '[role="menuitem"], [data-slot="dropdown-menu-item"], [data-radix-collection-item], [data-tier]'
  ));

  const matchedBySelection = menuItems.find((item) => {
    const text = (item.innerText || item.textContent || '').trim().toLowerCase();
    const value = (item.getAttribute('data-value') || item.getAttribute('data-tier') || '').toLowerCase();
    const selected = item.getAttribute('data-selected') === 'true' || item.getAttribute('aria-checked') === 'true';
    const hasFast = /fast/.test(text) || /fast/.test(value);
    const hasPro = /\bpro\b/.test(text) || /\bpro\b/.test(value);
    return selected && ((isTargetPro && hasPro) || (!isTargetPro && hasFast));
  });
  if (matchedBySelection) return matchedBySelection;

  return menuItems.find((item) => {
    const text = (item.innerText || item.textContent || '').trim().toLowerCase();
    const value = (item.getAttribute('data-value') || item.getAttribute('data-tier') || '').toLowerCase();
    const hasFast = /fast/.test(text) || /fast/.test(value);
    const hasPro = /\bpro\b/.test(text) || /\bpro\b/.test(value);
    return (isTargetPro && hasPro && !hasFast) || (!isTargetPro && hasFast && !hasPro);
  }) || menuItems.find((item) => {
    const text = (item.innerText || item.textContent || '').trim().toLowerCase();
    const value = (item.getAttribute('data-value') || item.getAttribute('data-tier') || '').toLowerCase();
    const hasFast = /fast/.test(text) || /fast/.test(value);
    const hasPro = /\bpro\b/.test(text) || /\bpro\b/.test(value);
    return (isTargetPro && hasPro) || (!isTargetPro && hasFast);
  });
}

async function executeDolaViaTabAutomation({
  prompt,
  modelName = 'SeaDance 2.5 (ByteDance)',
  modelValue = 'seedance_v2.5',
  ratio = '9:16',
  duration = 10,
  referenceAssets = [],
  isVideo = true,
  onProgress = () => {},
}) {
  onProgress(32, 'Mempersiapkan tab Dola untuk melewati verifikasi browser...');

  const { tab } = await getOrOpenDolaTab();

  // Siapkan data gambar referensi
  const refImagesData = [];
  const seenRefKeys = new Set();
  const validReferenceAssets = (Array.isArray(referenceAssets) ? referenceAssets : []).filter((asset) => {
    const source = asset?.dataUrl || asset?.base64 || asset?.url || asset?.downloadUrl || asset?.thumbnailUrl;
    return Boolean(source);
  });
  for (const asset of validReferenceAssets.slice(0, 3)) {
    try {
      const parsed = await assetToBytes(asset);
      const dataUrl = parsed.dataUrl?.startsWith('data:')
        ? parsed.dataUrl
        : bytesToDataUrl(parsed.bytes, parsed.mime);
      const refKey = `${parsed.bytes?.length || 0}_${dataUrl.slice(0, 60)}_${dataUrl.slice(-30)}`;
      if (!seenRefKeys.has(refKey)) {
        seenRefKeys.add(refKey);
        refImagesData.push({
          name: ensureImageFilename(parsed.filename, parsed.ext, parsed.mime),
          dataUrl,
          ext: parsed.ext,
        });
      }
    } catch (_) {}
  }

  const finalPrompt = formatDolaPromptWithRatio(prompt, ratio);
  onProgress(36, `Mengisi parameter ${isVideo ? 'SeaDance 2.5' : 'Dola AI'} & prompt ke editor tab...`);

  // Injeksi otomatisasi lengkap ke tab Dola (Model, Rasio, Durasi, Prompt, Gambar, & Generate)
  const injectionResult = await executeInDolaTab(
    tab.id,
    async (taskPrompt, taskRefImages, taskModelName, taskModelValue, taskRatio, taskDuration, isTaskVideo) => {
      try {
        const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

        const findDolaModeTriggerFromDom = (doc = document) => {
          return (
            doc.querySelector('[data-valid-btn="mode-select-action-btn"]') ||
            doc.querySelector('[data-slot="dropdown-menu-trigger"]') ||
            doc.querySelector('[data-input-engine-action-source="actionbar"] [aria-haspopup="menu"]') ||
            doc.querySelector('[data-testid="mode-select-btn"]') ||
            Array.from(doc.querySelectorAll('button, [role="button"], [data-slot="dropdown-menu-trigger"], [aria-haspopup="menu"]')).find((el) => {
              const text = (el.innerText || el.textContent || '').trim().toLowerCase();
              return (text === 'fast' || text === 'pro' || text.startsWith('fast') || text.startsWith('pro')) && !text.includes('create');
            })
          );
        };

        const findDolaModeMenuItemFromDom = (doc = document, isTargetPro = false) => {
          const menuItems = Array.from(doc.querySelectorAll(
            '[role="menuitem"], [data-slot="dropdown-menu-item"], [data-radix-collection-item], [data-tier]'
          )).filter((item) => {
            const rect = item.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && getComputedStyle(item).visibility !== 'hidden';
          });

          const matchedBySelection = menuItems.find((item) => {
            const text = (item.innerText || item.textContent || '').trim().toLowerCase();
            const value = (item.getAttribute('data-value') || item.getAttribute('data-tier') || '').toLowerCase();
            const selected = item.getAttribute('data-selected') === 'true' || item.getAttribute('aria-checked') === 'true';
            const hasFast = /fast/.test(text) || /fast/.test(value);
            const hasPro = /\bpro\b/.test(text) || /\bpro\b/.test(value);
            return selected && ((isTargetPro && hasPro) || (!isTargetPro && hasFast));
          });

          if (matchedBySelection) return matchedBySelection;

          return menuItems.find((item) => {
            const text = (item.innerText || item.textContent || '').trim().toLowerCase();
            const value = (item.getAttribute('data-value') || item.getAttribute('data-tier') || '').toLowerCase();
            const hasFast = /fast/.test(text) || /fast/.test(value);
            const hasPro = /\bpro\b/.test(text) || /\bpro\b/.test(value);
            return (isTargetPro && hasPro && !hasFast) || (!isTargetPro && hasFast && !hasPro);
          }) || menuItems.find((item) => {
            const text = (item.innerText || item.textContent || '').trim().toLowerCase();
            const value = (item.getAttribute('data-value') || item.getAttribute('data-tier') || '').toLowerCase();
            const hasFast = /fast/.test(text) || /fast/.test(value);
            const hasPro = /\bpro\b/.test(text) || /\bpro\b/.test(value);
            return (isTargetPro && hasPro) || (!isTargetPro && hasFast);
          });
        };

        // Helper untuk memicu klik realistis (React Handler + PointerEvent + MouseEvent)
        const triggerFullClick = (el) => {
          if (!el) return;
          try {
            el.scrollIntoView?.({ block: 'center', inline: 'center' });
            el.focus?.();
          } catch (_) {}

          // 1. Panggil langsung React internal handler (__reactProps$ / __reactEventHandlers$)
          try {
            const reactKey = Object.keys(el).find((k) =>
              k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$')
            );
            if (reactKey && el[reactKey]) {
              const p = el[reactKey];
              if (typeof p.onPointerDown === 'function') {
                p.onPointerDown({
                  preventDefault: () => {},
                  stopPropagation: () => {},
                  target: el,
                  currentTarget: el,
                });
              }
              if (typeof p.onClick === 'function') {
                p.onClick({
                  preventDefault: () => {},
                  stopPropagation: () => {},
                  target: el,
                  currentTarget: el,
                });
              }
            }
          } catch (_) {}

          // 2. Dispatch siklus lengkap Pointer & Mouse Event
          const rect = el.getBoundingClientRect();
          const clientX = rect.left + rect.width / 2;
          const clientY = rect.top + rect.height / 2;
          const evtOpts = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX,
            clientY,
            screenX: clientX + 10,
            screenY: clientY + 100,
            button: 0,
            buttons: 1,
          };

          if (typeof PointerEvent !== 'undefined') {
            el.dispatchEvent(new PointerEvent('pointerover', { ...evtOpts, buttons: 0 }));
            el.dispatchEvent(new PointerEvent('pointerenter', { ...evtOpts, buttons: 0 }));
            el.dispatchEvent(new PointerEvent('pointerdown', { ...evtOpts, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
          }
          el.dispatchEvent(new MouseEvent('mouseover', { ...evtOpts, buttons: 0 }));
          el.dispatchEvent(new MouseEvent('mousedown', { ...evtOpts }));

          if (typeof PointerEvent !== 'undefined') {
            el.dispatchEvent(new PointerEvent('pointerup', { ...evtOpts, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0 }));
          }
          el.dispatchEvent(new MouseEvent('mouseup', { ...evtOpts, buttons: 0 }));
          el.dispatchEvent(new MouseEvent('click', { ...evtOpts, buttons: 0 }));

          // 3. Native .click()
          try {
            el.click();
          } catch (_) {}
        };

        const clickDolaModeElement = (el) => {
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const eventOptions = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            button: 0,
          };
          el.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
          el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
          el.dispatchEvent(new PointerEvent('pointerup', eventOptions));
          el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
          el.dispatchEvent(new MouseEvent('click', eventOptions));
        };

        // 0. Buka Percakapan Baru (New Chat) agar setiap generate memiliki Chat ID masing-masing
        try {
          const findNewChatBtn = () => {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"], a[href*="/chat"]'));
            return buttons.find((btn) => {
              const aria = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase();
              if (aria.includes('new chat') || aria.includes('create chat') || aria.includes('compose')) return true;
              const paths = Array.from(btn.querySelectorAll('svg path'));
              return paths.some((p) => {
                const d = p.getAttribute('d') || '';
                return d.includes('1.99882') || d.includes('17.0459') || d.includes('11.5867') || d.includes('13.4549');
              });
            });
          };

          const newChatBtn = findNewChatBtn();
          const hasExistingMessages = !!document.querySelector('.creation_block, [data-message-id], div[class*="message-item"], [data-slot="message"]');
          if (newChatBtn && (hasExistingMessages || (window.location.pathname && window.location.pathname.length > 6))) {
            triggerFullClick(newChatBtn);
            await waitMs(600);
          }
        } catch (newChatErr) {
          console.warn('[weavy-dola-tab] New chat button trigger warning:', newChatErr);
        }

        // 1. Cari editor chat TipTap / ProseMirror
        let inputEl = null;
        for (let attempt = 0; attempt < 20; attempt++) {
          inputEl = document.querySelector(
            'div.tiptap.ProseMirror, #input-engine-container [contenteditable="true"], [data-chat-input], textarea, [contenteditable="true"]'
          );
          if (inputEl) break;
          await waitMs(350);
        }

        if (!inputEl) {
          return {
            success: false,
            error: 'Editor chat Dola tidak ditemukan. Pastikan Anda sudah login ke akun Dola di tab.',
          };
        }

        // 2. TENTUKAN TIER MODE (Fast vs Pro) & GANTI MODE DI ACTIONBAR DOLA
        const isTargetPro = (
          (taskModelName || '').toLowerCase().includes('pro') ||
          (taskModelName || '').toLowerCase().includes('2.5') ||
          (taskModelName || '').toLowerCase().includes('5.0') ||
          (taskModelValue || '').toLowerCase().includes('pro') ||
          (taskModelValue || '').toLowerCase().includes('2.5') ||
          (taskModelValue || '').toLowerCase().includes('5.0')
        );

        // Helper untuk menutup semua popover/dropdown Radix UI yang masih terbuka
        const closeAllPopovers = async () => {
          try {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
            await waitMs(100);
            const openMenus = Array.from(document.querySelectorAll('[data-radix-menu-content][data-state="open"], [data-slot="dropdown-menu-content"][data-state="open"], [data-creation-params-panel-id]'));
            if (openMenus.length > 0) {
              document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
              document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
              document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            }
          } catch (_) {}
        };

        // 2A. Beralih Mode Fast / Pro di trigger Dola yang benar-benar klikable di DOM
        try {
          const modeTrigger = findDolaModeTriggerFromDom(document);
          if (modeTrigger) {
            const currentModeText = (modeTrigger.innerText || modeTrigger.textContent || '').trim().toLowerCase();
            const hasTargetModeText = isTargetPro ? currentModeText.includes('pro') : currentModeText.includes('fast');
            const needsModeSwitch = !hasTargetModeText;

            if (needsModeSwitch) {
              const triggerTarget = modeTrigger.querySelector('button, [role="button"]') || modeTrigger;
              clickDolaModeElement(triggerTarget);

              let targetModeItem = null;
              for (let attempt = 0; attempt < 12; attempt += 1) {
                targetModeItem = findDolaModeMenuItemFromDom(document, isTargetPro);
                if (targetModeItem) break;
                await waitMs(150);
              }

              if (!targetModeItem) {
                return { success: false, error: `Menu mode Dola (${isTargetPro ? 'Pro' : 'Fast'}) tidak muncul.` };
              }

              const expectedMode = isTargetPro ? 'pro' : 'fast';
              let modeActivated = false;
              for (let retry = 0; retry < 2 && !modeActivated; retry += 1) {
                const currentModeItem = findDolaModeMenuItemFromDom(document, isTargetPro) || targetModeItem;
                clickDolaModeElement(currentModeItem);
                for (let attempt = 0; attempt < 12; attempt += 1) {
                  const updatedModeTrigger = findDolaModeTriggerFromDom(document) || modeTrigger;
                  const updatedModeText = (updatedModeTrigger.innerText || updatedModeTrigger.textContent || '').trim().toLowerCase();
                  if (updatedModeText.includes(expectedMode)) {
                    modeActivated = true;
                    break;
                  }
                  await waitMs(150);
                }
                if (!modeActivated && retry === 0) {
                  const retryTrigger = findDolaModeTriggerFromDom(document);
                  const retryTarget = retryTrigger?.querySelector('button, [role="button"]') || retryTrigger;
                  clickDolaModeElement(retryTarget);
                  await waitMs(150);
                }
              }

              if (!modeActivated) {
                return { success: false, error: `Mode Dola belum berubah ke ${isTargetPro ? 'Pro' : 'Fast'}.` };
              }
            }
          }
        } catch (modeErr) {
          console.warn('[weavy-dola-tab] Fast/Pro mode switch notice:', modeErr);
          await closeAllPopovers();
        }

        // 2B. Aktifkan Skill yang sesuai (Skill 17 = Create Videos, Skill 3 = Create Images)
        // Di Fast mode, tombol skill ada di toolbar utama (skill_bar_button_17 / skill_bar_button_3).
        // Di Pro mode, tombol skill berada di dalam menu popover "Skills" ([data-general-agent-skill-button="true"]) atau tombol "+".
        const openSkillsPopoverAndSelect = async (targetSkillName, targetSkillId) => {
          try {
            // Cari tombol "Skills" di action bar
            let skillsTrigger = (
              document.querySelector('[data-general-agent-skill-button="true"] button') ||
              document.querySelector('[data-agent-input-suggestion-trigger="true"] button') ||
              document.querySelector('[data-general-agent-skill-button="true"]') ||
              Array.from(document.querySelectorAll('.guidance-input-actions button, #input-engine-container button')).find((b) => {
                const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
                return txt === 'skills' || txt.startsWith('skills');
              }) ||
              // Fallback ke tombol (+) di paling kiri action bar
              document.querySelector('.guidance-input-actions button:has(svg path[d*="12.0005 2.25"])') ||
              document.querySelector('.guidance-input-actions [aria-haspopup="menu"] button')
            );

            if (skillsTrigger) {
              triggerFullClick(skillsTrigger);
              await waitMs(350);

              let menuItems = [];
              for (let mAttempt = 0; mAttempt < 6; mAttempt++) {
                const container = document.querySelector('[data-slot="dropdown-menu-content"], [data-radix-menu-content], [role="menu"], [data-creation-params-panel-id]');
                if (container) {
                  menuItems = Array.from(container.querySelectorAll('button, [data-slot="dropdown-menu-item"], [role="menuitem"], [role="option"], div[role="button"], div[class*="menu-item"]'));
                } else {
                  menuItems = Array.from(document.querySelectorAll(
                    '[data-slot="dropdown-menu-item"], [role="menuitem"], [role="option"], div[class*="DbxDropdownMenuItem"], div[class*="menu-item"], button'
                  ));
                }
                if (menuItems.length > 0) break;
                await waitMs(150);
              }

              if (menuItems.length > 0) {
                const matchedItem = menuItems.find((it) => {
                  const t = (it.innerText || it.textContent || '').toLowerCase();
                  const sId = it.getAttribute('data-skill-id') || it.getAttribute('data-value') || it.getAttribute('data-item-id') || '';
                  if (targetSkillId && (sId === String(targetSkillId) || sId.includes(String(targetSkillId)))) return true;
                  return t.includes(targetSkillName.toLowerCase());
                });

                if (matchedItem) {
                  triggerFullClick(matchedItem);
                  await waitMs(300);
                  return true;
                }
              }
              await closeAllPopovers();
            }
          } catch (skErr) {
            console.warn('[weavy-dola-tab] Skills popover selection notice:', skErr);
            await closeAllPopovers();
          }
          return false;
        };

        if (isTaskVideo) {
          const checkVideoActive = () => {
            return !!(
              document.querySelector('[data-input-engine-actionbar-control-key="video-model"]') ||
              document.querySelector('[data-input-engine-actionbar-control-key="video-duration"]') ||
              document.querySelector('[data-input-engine-actionbar-control-key="video-ratio"]') ||
              document.querySelector('[data-value="17"]') ||
              document.querySelector('[data-skill-id="skill_bar_button_17"][data-state="active"], [data-skill-id="skill_bar_button_17"][class*="active"]')
            );
          };

          if (!checkVideoActive()) {
            for (let vAttempt = 0; vAttempt < 3; vAttempt++) {
              // 1. Coba cari tombol direct "Create Videos" di toolbar (Fast mode)
              let videoBtn = document.querySelector(
                'button[data-skill-id="skill_bar_button_17"], [data-testid="skill_bar_button_17"], [data-skill-id="skill_bar_button_17"], [data-skill-id="17"]'
              );

              if (!videoBtn) {
                const allSkillBtns = Array.from(
                  document.querySelectorAll('button, div[role="button"], [data-component-type="skill-item"], [data-skill-id]')
                );
                videoBtn = allSkillBtns.find((el) => {
                  const t = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
                  const sId = el.getAttribute('data-skill-id') || el.getAttribute('data-item-id') || '';
                  return sId === '17' || sId === 'skill_bar_button_17' || t.includes('create video') || t.includes('create videos');
                });
              }

              if (videoBtn) {
                triggerFullClick(videoBtn);
              } else {
                // 2. Jika tidak ada direct button (misal di Pro mode), buka menu Skills / (+) popover
                await openSkillsPopoverAndSelect('Create Videos', 17);
              }

              // Tunggu transisi mode video aktif
              for (let w = 0; w < 10; w++) {
                await waitMs(150);
                if (checkVideoActive()) break;
              }
              if (checkVideoActive()) break;
            }
          }
        } else if (isTargetPro) {
          // PRO MODE IMAGE GENERATION:
          // PENTING: Dola Pro Mode adalah generasi gambar multimodal terpadu.
          // JANGAN aktifkan Skill 3 ("Create Images") dan JANGAN buka popover skills!
          // Membuka Skill 3 pada Dola akan secara paksa mengalihkan Dola kembali ke Fast Mode!
          try {
            const activeSkillCloseBtns = Array.from(document.querySelectorAll(
              '[data-skill-id] button[aria-label*="close"], [data-skill-id] button[aria-label*="Remove"], .skill-tag-remove, button[class*="close-skill"], [data-skill-id] svg'
            ));
            for (const btn of activeSkillCloseBtns) {
              triggerFullClick(btn);
              await waitMs(100);
            }
          } catch (_) {}
        } else {
          // Mode Gambar (Skill 3: Create Images)
          const checkImageActive = () => {
            return !!(
              document.querySelector('[data-input-engine-actionbar-control-key="image_creation_model"]') ||
              document.querySelector('[data-input-engine-actionbar-control-key="image_creation_ratio"]') ||
              document.querySelector('[data-value="3"]') ||
              document.querySelector('[data-skill-id="skill_bar_button_3"][data-state="active"], [data-skill-id="skill_bar_button_3"][class*="active"]')
            );
          };

          if (!checkImageActive()) {
            for (let imgAttempt = 0; imgAttempt < 3; imgAttempt++) {
              // 1. Coba cari tombol direct "Create Images" di toolbar (Fast mode)
              let imgBtn = document.querySelector(
                'button[data-skill-id="skill_bar_button_3"], [data-testid="skill_bar_button_3"], [data-skill-id="skill_bar_button_3"], [data-skill-id="3"]'
              );
              if (!imgBtn) {
                const allBtns = Array.from(document.querySelectorAll('button, div[role="button"], [data-component-type="skill-item"]'));
                imgBtn = allBtns.find((el) => {
                  const t = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
                  const sId = el.getAttribute('data-skill-id') || '';
                  return sId === '3' || sId === 'skill_bar_button_3' || t.includes('create image') || t.includes('create images');
                });
              }

              if (imgBtn) {
                triggerFullClick(imgBtn);
              } else {
                // 2. Jika tidak ada direct button (misal di Pro mode), buka menu Skills / (+) popover
                await openSkillsPopoverAndSelect('Create Images', 3);
              }

              // Tunggu transisi mode gambar aktif (image_creation_model / image_creation_ratio muncul)
              for (let w = 0; w < 12; w++) {
                await waitMs(150);
                if (checkImageActive()) break;
              }
              if (checkImageActive()) break;
            }
          }
        }

        await waitMs(300);

        // 3. PILIH SUB-MODEL JIKA ADA DROPDOWN MODEL KHUSUS DI SKILL BAR
        if (isTaskVideo || !isTargetPro) {
          try {
            const isTarget5Pro = !isTaskVideo && isTargetPro;

          const isTargetVideoFast20 = isTaskVideo && (
            (taskModelName || '').toLowerCase().includes('2.0') ||
            (taskModelName || '').toLowerCase().includes('fast') ||
            (taskModelValue || '').toLowerCase().includes('2.0') ||
            (taskModelValue || '').toLowerCase().includes('fast')
          );

          const isTargetVideo10 = isTaskVideo && (
            (taskModelName || '').toLowerCase().includes('1.0') ||
            (taskModelValue || '').toLowerCase().includes('1.0')
          );

          const findModelTrigger = () => {
            return (
              document.querySelector(
                isTaskVideo
                  ? '[data-input-engine-actionbar-control-key="video-model"], [data-input-engine-actionbar-control-key*="model"]'
                  : '[data-input-engine-actionbar-control-key="image_creation_model"], [data-input-engine-actionbar-control-key*="model"]'
              ) ||
              Array.from(document.querySelectorAll('#input-engine-container button, [data-input-engine-action-source="actionbar"]')).find((b) => {
                const txt = (b.innerText || b.textContent || '').toLowerCase();
                return (txt.includes('seedance') || txt.includes('seadance') || txt.includes('seedream') || txt.includes('2.5') || txt.includes('2.0') || txt.includes('5.0') || txt.includes('4.5')) && !b.getAttribute('data-valid-btn');
              })
            );
          };

          const modelTrigger = findModelTrigger();

          if (modelTrigger) {
            const currentModelText = (modelTrigger.innerText || modelTrigger.textContent || '').toLowerCase();
            let needModelClick = false;

            if (isTaskVideo) {
              if (isTargetVideoFast20) {
                needModelClick = !currentModelText.includes('2.0') && !currentModelText.includes('fast');
              } else if (isTargetVideo10) {
                needModelClick = !currentModelText.includes('1.0');
              } else {
                // Default 2.5
                needModelClick = !currentModelText.includes('2.5');
              }
            } else if (isTarget5Pro) {
              needModelClick = !currentModelText.includes('5.0') && !currentModelText.includes('pro');
            } else {
              // Target Seedream 4.5
              needModelClick = !currentModelText.includes('4.5');
            }

            if (needModelClick) {
              triggerFullClick(modelTrigger);
              await waitMs(350);

              let menuItems = [];
              for (let mAttempt = 0; mAttempt < 5; mAttempt++) {
                const container = document.querySelector('[data-slot="dropdown-menu-content"], [data-radix-menu-content], [role="menu"], [data-creation-params-panel-id]');
                if (container) {
                  menuItems = Array.from(container.querySelectorAll('button, [data-slot="dropdown-menu-item"], [role="menuitem"], [role="option"], div[role="button"]'));
                } else {
                  menuItems = Array.from(document.querySelectorAll(
                    '[data-slot="dropdown-menu-item"], [role="menuitem"], [role="option"], div[class*="DbxDropdownMenuItem"], div[class*="menu-item"], button'
                  ));
                }
                if (menuItems.length > 0) break;
                await waitMs(150);
              }

              let targetItem = null;
              if (isTaskVideo) {
                if (isTargetVideoFast20) {
                  targetItem = menuItems.find((it) => {
                    const t = (it.innerText || it.textContent || '').toLowerCase();
                    return t.includes('2.0') || t.includes('fast') || t.includes('fast results');
                  });
                } else if (isTargetVideo10) {
                  targetItem = menuItems.find((it) => {
                    const t = (it.innerText || it.textContent || '').toLowerCase();
                    return t.includes('1.0') || t.includes('simple');
                  });
                } else {
                  // 2.5
                  targetItem = menuItems.find((it) => {
                    const t = (it.innerText || it.textContent || '').toLowerCase();
                    return t.includes('2.5') || t.includes('best quality') || t.includes('seedance 2.5');
                  }) || menuItems.find((it) => {
                    const t = (it.innerText || it.textContent || '').toLowerCase();
                    return t.includes('seadance') || t.includes('seedance');
                  });
                }
              } else if (isTarget5Pro) {
                // Seedream 5.0 Pro
                targetItem = menuItems.find((it) => {
                  const t = (it.innerText || it.textContent || '').toLowerCase();
                  return t.includes('5.0') || t.includes('seedream 5.0') || (t.includes('pro') && t.includes('seedream'));
                });
              } else {
                // Seedream 4.5
                targetItem = menuItems.find((it) => {
                  const t = (it.innerText || it.textContent || '').toLowerCase();
                  return t.includes('4.5') || t.includes('seedream 4.5') || t.includes('daily use');
                });
              }

              if (targetItem) {
                triggerFullClick(targetItem);
                await waitMs(250);
              }
              await closeAllPopovers();
            }
          }
        } catch (modelErr) {
          console.warn('[weavy-dola-tab] Model selection warning:', modelErr);
          await closeAllPopovers();
        }
      }

        // 4. PILIH ASPECT RATIO (9:16, 16:9, 1:1, 3:4, 4:3, 21:9, 2:3)
        // Di Pro Mode Gambar, tidak ada ratio dropdown di UI Dola
        if (isTaskVideo || !isTargetPro) {
          try {
            if (taskRatio) {
              const normRatio = String(taskRatio).trim();
              const findRatioTrigger = () => {
                return (
                  document.querySelector('[data-input-engine-actionbar-control-key="video-ratio"]') ||
                  document.querySelector('[data-input-engine-actionbar-control-key="image_creation_ratio"]') ||
                  document.querySelector('[data-input-engine-actionbar-control-key*="ratio"]') ||
                  Array.from(document.querySelectorAll('#input-engine-container button, [data-input-engine-action-source="actionbar"], button[data-slot="dropdown-menu-trigger"]')).find((b) => {
                    const t = (b.innerText || b.textContent || '').toLowerCase();
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    const ctrlKey = (b.getAttribute('data-input-engine-actionbar-control-key') || '').toLowerCase();
                    return ctrlKey.includes('ratio') || t.includes('ratio') || aria.includes('ratio') ||
                      /\b(9:16|16:9|1:1|3:4|4:3|21:9|2:3|auto)\b/.test(t);
                  })
                );
              };

              const ratioTrigger = findRatioTrigger();
              if (ratioTrigger) {
                const currentRatioText = (ratioTrigger.innerText || ratioTrigger.textContent || '').toLowerCase();
                const targetRatioClean = normRatio.toLowerCase();

                // Hanya klik trigger jika nilai saat ini belum sesuai
                if (!currentRatioText.includes(targetRatioClean)) {
                  triggerFullClick(ratioTrigger);
                  await waitMs(350);

                  let ratioItems = [];
                  for (let rAttempt = 0; rAttempt < 5; rAttempt++) {
                    const container = document.querySelector('[data-slot="dropdown-menu-content"], [data-radix-menu-content], [role="menu"], [data-creation-params-panel-id]');
                    if (container) {
                      ratioItems = Array.from(container.querySelectorAll('button, [data-slot="dropdown-menu-item"], [role="menuitem"], [role="option"], div[role="button"]'));
                    } else {
                      ratioItems = Array.from(document.querySelectorAll(
                        '[data-slot="dropdown-menu-item"], [role="menuitem"], [role="option"], div[class*="DbxDropdownMenuItem"], div[class*="dropdown-menu-item"]'
                      ));
                    }
                    if (ratioItems.length > 0) break;
                    await waitMs(150);
                  }

                  if (ratioItems.length > 0) {
                    const targetRatioItem = ratioItems.find((it) => {
                      const t = (it.innerText || it.textContent || '').trim().toLowerCase();
                      return t === targetRatioClean || t.startsWith(targetRatioClean) || t.includes(targetRatioClean);
                    });

                    if (targetRatioItem) {
                      triggerFullClick(targetRatioItem);
                      await waitMs(250);
                    }
                  }
                  await closeAllPopovers();
                }
              }
            }
          } catch (ratioErr) {
            console.warn('[weavy-dola-tab] Ratio selection warning:', ratioErr);
            await closeAllPopovers();
          }
        }

        // 5. PILIH DURASI VIDEO (5s atau 10s)
        try {
          if (isTaskVideo && taskDuration) {
            const durationStr = `${taskDuration}s`;
            const findDurationTrigger = () => {
              return (
                document.querySelector('[data-input-engine-actionbar-control-key="video-duration"]') ||
                document.querySelector('[data-input-engine-actionbar-control-key*="duration"]') ||
                Array.from(document.querySelectorAll('#input-engine-container button, [data-input-engine-action-source="actionbar"], button[data-slot="dropdown-menu-trigger"]')).find((b) => {
                  const t = (b.innerText || b.textContent || '').toLowerCase();
                  const ctrlKey = (b.getAttribute('data-input-engine-actionbar-control-key') || '').toLowerCase();
                  return ctrlKey.includes('duration') || t.includes('duration') || t.includes('10s') || t.includes('5s');
                })
              );
            };

            const durationTrigger = findDurationTrigger();
            if (durationTrigger) {
              const currentDurText = (durationTrigger.innerText || durationTrigger.textContent || '').toLowerCase();
              if (!currentDurText.includes(durationStr.toLowerCase())) {
                triggerFullClick(durationTrigger);
                await waitMs(350);

                let durationItems = [];
                for (let dAttempt = 0; dAttempt < 5; dAttempt++) {
                  const container = document.querySelector('[data-slot="dropdown-menu-content"], [data-radix-menu-content], [role="menu"], [data-creation-params-panel-id]');
                  if (container) {
                    durationItems = Array.from(container.querySelectorAll('button, [data-slot="dropdown-menu-item"], [role="menuitem"], [role="option"], div[role="button"]'));
                  } else {
                    durationItems = Array.from(document.querySelectorAll(
                      '[data-slot="dropdown-menu-item"], [role="menuitem"], [role="option"], div[class*="DbxDropdownMenuItem"], div[class*="dropdown-menu-item"]'
                    ));
                  }
                  if (durationItems.length > 0) break;
                  await waitMs(150);
                }

                if (durationItems.length > 0) {
                  const targetDurItem = durationItems.find((it) => {
                    const t = (it.innerText || it.textContent || '').trim().toLowerCase();
                    return t.startsWith(durationStr.toLowerCase()) || t.includes(durationStr.toLowerCase()) || t.startsWith(String(taskDuration));
                  });

                  if (targetDurItem) {
                    triggerFullClick(targetDurItem);
                    await waitMs(250);
                  }
                }
                await closeAllPopovers();
              }
            }
          }
        } catch (durErr) {
          console.warn('[weavy-dola-tab] Duration selection warning:', durErr);
          await closeAllPopovers();
        }

        // Pastikan tidak ada popover/menu yang masih melayang sebelum mengetik prompt
        await closeAllPopovers();

        // 6. MASUKKAN PROMPT KE TIPTAP / PROSEMIRROR DENGAN HANDLER RESMI
        for (let inputAttempt = 0; inputAttempt < 20; inputAttempt += 1) {
          const freshInput = document.querySelector(
            'div.tiptap.ProseMirror, #input-engine-container [contenteditable="true"], [data-chat-input], textarea, [contenteditable="true"]'
          );
          if (freshInput) {
            inputEl = freshInput;
            break;
          }
          await waitMs(200);
        }
        if (!inputEl) {
          return { success: false, error: 'Editor Dola hilang setelah pengaturan generate selesai.' };
        }
        inputEl.focus();
        try {
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
        } catch (_) {}

        let inserted = false;
        try {
          inserted = document.execCommand('insertText', false, taskPrompt);
        } catch (_) {}

        if (!inputEl.textContent.trim()) {
          try {
            const textTransfer = new DataTransfer();
            textTransfer.setData('text/plain', taskPrompt);
            inputEl.dispatchEvent(new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: textTransfer,
            }));
          } catch (_) {}
        }

        inputEl.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: taskPrompt,
        }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));

        // 7. UNGGAH GAMBAR REFERENSI (jika ada)
        if (taskRefImages && taskRefImages.length > 0) {
          const dt = new DataTransfer();
          for (let i = 0; i < taskRefImages.length; i++) {
            const item = taskRefImages[i];
            const parts = (item.dataUrl || '').split(',');
            if (parts.length === 2) {
              const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
              const bstr = atob(parts[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while (n--) u8arr[n] = bstr.charCodeAt(n);
              const file = new File([u8arr], item.name || `ref_${i + 1}.jpg`, { type: mime });
              dt.items.add(file);
            }
          }

          if (dt.files.length > 0) {
            const fileInputs = Array.from(document.querySelectorAll(
              '#input-engine-container input[type="file"], [data-testid*="upload"] input[type="file"], input[type="file"]'
            ));
            const fileInput = fileInputs.find((input) => {
              const rect = input.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && getComputedStyle(input).visibility !== 'hidden';
            }) || fileInputs[0];
            if (fileInput) {
              try {
                fileInput.files = dt.files;
                fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
              } catch (_) {}
            }

            // Tunggu upload thumbnail selesai (maksimal 10 detik)
            for (let w = 0; w < 20; w++) {
              await waitMs(500);
              const spinners = document.querySelectorAll(
                '#input-engine-container [class*="spin"], #input-engine-container [class*="loading"], #input-engine-container [class*="progress"]'
              );
              if (spinners.length === 0) break;
            }
          }
        }

        // Upload referensi dapat mengganti node ProseMirror; isi ulang prompt setelah upload selesai.
        await waitMs(500);
        const finalInput = document.querySelector(
          'div.tiptap.ProseMirror, #input-engine-container [contenteditable="true"], [data-chat-input], textarea, [contenteditable="true"]'
        );
        if (finalInput && !(finalInput.textContent || finalInput.value || '').includes(taskPrompt)) {
          finalInput.focus();
          try {
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, taskPrompt);
          } catch (_) {}
          if (!(finalInput.textContent || finalInput.value || '').includes(taskPrompt)) {
            const textTransfer = new DataTransfer();
            textTransfer.setData('text/plain', taskPrompt);
            finalInput.dispatchEvent(new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: textTransfer,
            }));
          }
          finalInput.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: taskPrompt,
          }));
          inputEl = finalInput;
        }

        await waitMs(500);

        // 8. KLIK TOMBOL GENERATE / KIRIM (ID resmi #flow-end-msg-send)
        const findSendBtn = () => {
          return (
            document.getElementById('flow-end-msg-send') ||
            document.querySelector('#flow-end-msg-send') ||
            document.querySelector('.send-btn-wrapper button') ||
            document.querySelector('button[data-dbx-name="button"][id*="send"]') ||
            document.querySelector('button[data-testid="chat-input-send-button"]') ||
            document.querySelector('button[data-testid="send-button"]') ||
            document.querySelector('button[data-testid*="send"]') ||
            document.querySelector('.send-btn-wrapper [role="button"]') ||
            Array.from(document.querySelectorAll('#input-engine-container button, button')).find((btn) => {
              const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
              const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
              const cls = (btn.className || '').toLowerCase();
              const id = (btn.id || '').toLowerCase();
              return (id.includes('send') || aria.includes('send') || aria.includes('kirim') || testId.includes('send') || cls.includes('send')) && !btn.disabled;
            })
          );
        };

        // Tunggu tombol send aktif (data-disabled="false" / aria-disabled="false")
        let sendBtn = findSendBtn();
        for (let w = 0; w < 20; w++) {
          if (
            sendBtn &&
            !sendBtn.disabled &&
            sendBtn.getAttribute('aria-disabled') !== 'true' &&
            sendBtn.getAttribute('data-disabled') !== 'true'
          ) {
            break;
          }
          await waitMs(300);
          sendBtn = findSendBtn();
        }

        // Fungsi cek apakah Dola sudah mulai memproses task
        const isGenerationStarted = () => {
          const breakBtn = document.querySelector('.break-btn-fISNgC:not(.\\!hidden), [class*="break-btn"]:not([class*="hidden"])');
          if (breakBtn && window.getComputedStyle(breakBtn).display !== 'none') return true;

          const btn = findSendBtn();
          if (btn) {
            const isLoading = btn.getAttribute('data-loading') === 'true';
            const isDisabled = btn.getAttribute('data-disabled') === 'true' || btn.disabled;
            const isNotAllowed = btn.classList.contains('cursor-not-allowed') || (btn.className || '').includes('disabled-bg');
            if (isLoading || (isDisabled && isNotAllowed)) return true;
          }

          const isEditorEmpty = !!inputEl.querySelector('.is-empty, .is-editor-empty') || !inputEl.textContent.trim();
          if (isEditorEmpty && (!btn || btn.getAttribute('data-disabled') === 'true')) return true;

          return false;
        };

        // Lakukan klik dengan retry loop untuk memastikan request terkirim ke server Dola
        let clicked = false;
        for (let attempt = 0; attempt < 6; attempt++) {
          if (isGenerationStarted()) {
            clicked = true;
            break;
          }

          const currentBtn = findSendBtn();
          if (currentBtn) {
            triggerFullClick(currentBtn);
            const inner = currentBtn.querySelector('svg, div');
            if (inner) triggerFullClick(inner);
            const wrapper = currentBtn.closest('.send-btn-wrapper');
            if (wrapper) triggerFullClick(wrapper);
            clicked = true;
          }

          await waitMs(400);

          if (isGenerationStarted()) {
            clicked = true;
            break;
          }
        }

        // Fallback cadangan hanya jika belum terkirim setelah semua klik
        if (!isGenerationStarted()) {
          inputEl.focus();
          inputEl.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
          }));
          inputEl.dispatchEvent(new KeyboardEvent('keyup', {
            bubbles: true,
            cancelable: true,
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
          }));
        }

        await waitMs(1000);

        // Deteksi jika muncul slider captcha di halaman
        const hasCaptcha = !!document.querySelector('div.captcha-slider, [class*="captcha"], [class*="verify"], [id*="captcha"], [class*="shark"]');

        return {
          success: true,
          clicked,
          hasCaptcha,
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [finalPrompt, refImagesData, modelName, modelValue, ratio, duration, isVideo],
    'MAIN'
  );

  const tabRes = injectionResult?.[0]?.result;
  if (tabRes?.hasCaptcha) {
    onProgress(38, '⚠️ Mohon selesaikan verifikasi geser (slider captcha) di tab Dola jika diminta...');
  } else {
    onProgress(40, 'Perintah berhasil dikirim ke Dola. Menunggu proses render...');
  }

  // Ambil ID percakapan dari URL tab jika ada
  await wait(2500);
  let convId = null;
  try {
    const urlCheck = await executeInDolaTab(tab.id, () => {
      const m = window.location.href.match(/\/chat\/(\d+)/);
      return m ? m[1] : null;
    });
    convId = urlCheck?.[0]?.result || null;
  } catch (_) {}

  // Mulai polling background via /im/chain/recent_conv + polling DOM tab
  const taskStartTimeSec = Math.floor(Date.now() / 1000);
  const maxTimeoutMs = (isVideo ? 12 : 6) * 60 * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxTimeoutMs) {
    await wait(3500);
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const targetSec = isVideo ? (duration === 5 ? 55 : 85) : 35;
    const pct = Math.min(95, 40 + Math.round((elapsedSec / targetSec) * 55));
    onProgress(pct, `Sedang memproses ${isVideo ? 'video 1080p' : 'gambar'} (${elapsedSec}s)...`);

    // 1. Polling API background
    try {
      const pollRes = await pollRecentConv({
        targetConvId: convId,
        startSec: taskStartTimeSec,
        isVideo,
      });

      if (pollRes.convId && !convId) convId = pollRes.convId;

      if (pollRes.status === 'completed') {
        if (isVideo && pollRes.videoObj) {
          const videoUrl = extractUnwatermarkedDolaVideoUrl(pollRes.videoObj);
          if (videoUrl) {
            onProgress(100, 'Video SeaDance 2.5 1080p siap!');
            return {
              url: videoUrl,
              chatId: pollRes.convId || convId,
            };
          }
        }
        if (!isVideo && pollRes.imageObj) {
          const imageUrl = extractDolaImageUrl(pollRes.imageObj);
          if (imageUrl) {
            onProgress(100, 'Gambar Dola AI siap!');
            return {
              url: imageUrl,
              chatId: pollRes.convId || convId,
            };
          }
        }
      }
    } catch (e) {
      console.warn('[weavy-dola] Tab polling notice:', e);
    }

    // 2. Polling langsung ke DOM tab Dola jika media sudah selesai
    try {
      const domResult = await executeInDolaTab(
        tab.id,
        (isVideoTask) => {
          if (isVideoTask) {
            // Ambil video dari urutan terakhir (paling baru) agar tidak mengambil video lama
            const videoEls = Array.from(document.querySelectorAll('video[src], video source[src], div[class*="creation"] video')).reverse();
            for (const v of videoEls) {
              const src = v.currentSrc || v.src || v.getAttribute('src');
              if (src && src.startsWith('http') && !src.includes('blob:')) {
                const urlMatch = window.location.href.match(/\/chat\/(\d+)/);
                return { type: 'video', url: src, chatId: urlMatch ? urlMatch[1] : null };
              }
            }
          } else {
            // Ambil gambar dari urutan terakhir (paling baru)
            const imgEls = Array.from(document.querySelectorAll(
              '[data-message-id] img, [data-slot="message"] img, [class*="message"] img, [class*="creation"] img, [class*="image-card"] img, main img'
            )).reverse();
            for (const img of imgEls) {
              const src = img.getAttribute('data-origin-url') || img.getAttribute('data-download-url') || img.src || img.getAttribute('src');
              const rect = img.getBoundingClientRect();
              const visible = rect.width > 40 && rect.height > 40 && window.getComputedStyle(img).visibility !== 'hidden';
              if (visible && src && src.startsWith('http') && !src.includes('data:') && !src.includes('avatar') && !src.includes('logo') && !src.includes('download-windows')) {
                const urlMatch = window.location.href.match(/\/chat\/(\d+)/);
                return { type: 'image', url: src, chatId: urlMatch ? urlMatch[1] : null };
              }
            }
          }
          return null;
        },
        [isVideo]
      );

      const domItem = domResult?.[0]?.result;
      if (domItem?.url) {
        const finalUrl = isVideo ? domItem.url : cleanByteDanceCdnImageUrl(domItem.url);
        console.log('[weavy-dola] ✅ Mendeteksi hasil render unwatermarked langsung dari tab DOM:', finalUrl);
        onProgress(100, isVideo ? 'Video SeaDance 2.5 1080p siap!' : 'Gambar Dola AI siap!');
        return {
          url: finalUrl,
          chatId: domItem.chatId || convId,
        };
      }
    } catch (_) {}
  }

  throw new Error(`Timeout: ${isVideo ? 'Video' : 'Gambar'} membutuhkan waktu lebih lama.`);
}

// -----------------------------------------------------------------------------
// EXPORT UTAMA: executeDolaVideoGeneration & executeDolaImageGeneration
// Menggabungkan Background API Pertama + Fallback Tab UI Otomatis
// -----------------------------------------------------------------------------

export async function executeDolaVideoGeneration({
  prompt,
  model,
  aspectRatio = '9:16',
  resolution = '1080p',
  videoDuration = '10s',
  referenceAssets = [],
  account = null,
  onProgress = () => {},
} = {}) {
  const modelName = model?.name || 'Dreamina Seedance 2.0 Fast';
  const modelValue = model?.value || 'seedance_v2.0_fast';
  const durationNum = String(videoDuration).includes('5') ? 5 : 10;
  const durationLabel = `${durationNum}s`;
  const formattedPrompt = formatDolaPromptWithRatio(prompt, aspectRatio);

  console.log('[weavy-dola] Memulai generate video Dola:', {
    rawPrompt: prompt.slice(0, 60),
    formattedPrompt: formattedPrompt.slice(0, 80),
    model: modelName,
    modelValue,
    aspectRatio,
    resolution,
    durationNum,
    refImagesCount: referenceAssets.length,
  });

  // Upload gambar referensi jika ada
  const uploadedRefs = [];
  if (referenceAssets && referenceAssets.length > 0) {
    onProgress(15, `Mengunggah ${referenceAssets.length} gambar referensi ke storage ByteDance ImageX...`);
    for (let i = 0; i < Math.min(referenceAssets.length, 3); i++) {
      try {
        const uploaded = await uploadDolaReferenceImage(referenceAssets[i]);
        if (uploaded?.uri) uploadedRefs.push(uploaded);
      } catch (err) {
        console.warn(`[weavy-dola] Gagal background upload ref ${i + 1}:`, err);
      }
    }
  }

  // 1. STRATEGI UTAMA: Coba 100% Background Silent via Tab Context Bridge (Tanpa gerak kursor)
  try {
    onProgress(25, `Mengirim task ${modelName} via endpoint /chat/completion (1080p, ${aspectRatio}, ${durationLabel})...`);

    const completionResult = await sendDolaBackgroundCompletion({
      prompt: formattedPrompt,
      ratio: aspectRatio,
      duration: durationNum,
      uploadedRefImages: uploadedRefs,
      isVideo: true,
      model: modelValue,
    });

    const { serverConvId, startTimeSec } = completionResult;
    let detectedConvId = serverConvId;

    onProgress(38, `Menunggu ${modelName} memproses video 1080p HD (${durationLabel})...`);

    // Polling background
    const startTime = Date.now();
    const maxTimeoutMs = 12 * 60 * 1000;

    while (Date.now() - startTime < maxTimeoutMs) {
      await wait(3500);
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      const simulatedPct = Math.min(95, 38 + Math.round((elapsedSec / (durationNum === 5 ? 55 : 85)) * 57));
      onProgress(simulatedPct, `${modelName} merender video 1080p HD (${elapsedSec}s)...`);

      try {
        const pollRes = await pollRecentConv({
          targetConvId: detectedConvId,
          startSec: startTimeSec,
          isVideo: true,
        });

        if (pollRes.convId && !detectedConvId) detectedConvId = pollRes.convId;

        if (pollRes.status === 'completed' && pollRes.videoObj) {
          const videoUrl = extractUnwatermarkedDolaVideoUrl(pollRes.videoObj);
          if (videoUrl) {
            if (account) {
              account.lastGeneratedDate = getTodayLocalDateStr();
              account.credits = typeof pollRes.remainingCredit === 'number'
                ? pollRes.remainingCredit
                : (typeof completionResult?.remainingCredit === 'number' ? completionResult.remainingCredit : 0);
            }
            onProgress(100, `Video ${modelName} 1080p siap!`);
            return {
              url: videoUrl,
              chatId: pollRes.convId || detectedConvId,
            };
          }
        }
      } catch (pollErr) {
        console.warn('[weavy-dola] Poll warning:', pollErr);
      }
    }
  } catch (err) {
    // 2. STRATEGI FALLBACK: Jika terdeteksi Rate Limit WAF Shark Admin / Slider Captcha (Error 710022004)
    if (
      err.message === 'DOLA_WAF_RATE_LIMIT' ||
      err.code === 710022004 ||
      String(err).includes('rate limited') ||
      String(err).includes('STREAM_ERROR') ||
      String(err).includes('shark_admin')
    ) {
      console.warn('[weavy-dola] 🛡️ Proteksi WAF ByteDance (Shark/Slider) aktif pada background endpoint. Mengaktifkan Fallback Tab Otomatis...');
      onProgress(30, 'Proteksi anti-bot Dola aktif (Shark/Slider). Mengalihkan ke mode tab otomatis...');

      return await executeDolaViaTabAutomation({
        prompt: formattedPrompt,
        modelName,
        modelValue,
        ratio: aspectRatio,
        duration: durationNum,
        referenceAssets,
        isVideo: true,
        onProgress,
      });
    }

    console.warn('[weavy-dola] Error atau WAF pada silent video generation, beralih ke Fallback Tab Otomatis:', err);
    onProgress(30, 'Mengalihkan ke mode tab otomatis cadangan...');
    return await executeDolaViaTabAutomation({
      prompt: formattedPrompt,
      modelName,
      modelValue,
      ratio: aspectRatio,
      duration: durationNum,
      referenceAssets,
      isVideo: true,
      onProgress,
    });
  }

  // Fallback jika timeout polling background
  console.warn('[weavy-dola] Polling silent timeout, mencoba fallback Tab Otomatis...');
  return await executeDolaViaTabAutomation({
    prompt: formattedPrompt,
    modelName,
    modelValue,
    ratio: aspectRatio,
    duration: durationNum,
    referenceAssets,
    isVideo: true,
    onProgress,
  });
}

export async function executeDolaImageGeneration({
  prompt,
  model = null,
  aspectRatio = '1:1',
  referenceAssets = [],
  account = null,
  onProgress = () => {},
} = {}) {
  const isPro = String(model?.name || '').toLowerCase().includes('pro') ||
    String(model?.id || '').toLowerCase().includes('pro') ||
    String(model?.value || '').toLowerCase().includes('pro') ||
    String(model?.badge || '').toLowerCase().includes('pro');

  const modelName = isPro ? 'Dola AI (💎 Pro)' : (model?.name || 'Seedream 4.5 (⚡ Fast)');
  const modelValue = isPro ? 'pro' : (model?.value || 'seedream_v4.5');
  const formattedPrompt = isPro ? prompt.trim() : formatDolaPromptWithRatio(prompt, aspectRatio);

  console.log('[weavy-dola] Memulai generate gambar Dola:', {
    rawPrompt: prompt.slice(0, 60),
    formattedPrompt: formattedPrompt.slice(0, 80),
    isPro,
    modelName,
    modelValue,
    aspectRatio,
    refImagesCount: referenceAssets.length,
  });

  // Upload referensi gambar jika ada
  const uploadedRefs = [];
  if (referenceAssets && referenceAssets.length > 0) {
    onProgress(15, `Mengunggah ${referenceAssets.length} gambar referensi ke storage ByteDance...`);
    for (let i = 0; i < Math.min(referenceAssets.length, 3); i++) {
      try {
        const uploaded = await uploadDolaReferenceImage(referenceAssets[i]);
        if (uploaded?.uri) uploadedRefs.push(uploaded);
      } catch (err) {
        console.warn(`[weavy-dola] Gagal background upload ref ${i + 1}:`, err);
      }
    }
  }

  // 1. STRATEGI UTAMA: Coba 100% Background Silent via Tab Context Bridge (Tanpa gerak kursor)
  try {
    onProgress(25, `Mengirim task ${modelName} via endpoint Dola /chat/completion...`);

    const completionResult = await sendDolaBackgroundCompletion({
      prompt: formattedPrompt,
      ratio: aspectRatio,
      uploadedRefImages: uploadedRefs,
      isVideo: false,
      model: isPro ? 'pro' : 'general',
    });

    const { serverConvId, startTimeSec } = completionResult;
    let detectedConvId = serverConvId;

    onProgress(45, `${modelName} sedang memproses pembuatan gambar HD...`);

    const startTime = Date.now();
    const maxTimeoutMs = 6 * 60 * 1000;

    while (Date.now() - startTime < maxTimeoutMs) {
      await wait(3000);
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      const simulatedPct = Math.min(95, 45 + Math.round((elapsedSec / 30) * 50));
      onProgress(simulatedPct, `${modelName} sedang memproses gambar (${elapsedSec}s)...`);

      try {
        const pollRes = await pollRecentConv({
          targetConvId: detectedConvId,
          startSec: startTimeSec,
          isVideo: false,
        });

        if (pollRes.convId && !detectedConvId) detectedConvId = pollRes.convId;

        if (pollRes.status === 'completed' && pollRes.imageObj) {
          const imageUrl = extractDolaImageUrl(pollRes.imageObj);
          if (imageUrl) {
            if (account) {
              account.lastGeneratedDate = getTodayLocalDateStr();
              account.credits = typeof pollRes.remainingCredit === 'number'
                ? pollRes.remainingCredit
                : (typeof completionResult?.remainingCredit === 'number' ? completionResult.remainingCredit : 0);
            }
            onProgress(100, `Gambar ${modelName} siap!`);
            return {
              url: imageUrl,
              chatId: pollRes.convId || detectedConvId,
            };
          }
        }
      } catch (pollErr) {
        console.warn('[weavy-dola] Poll warning:', pollErr);
      }
    }
  } catch (err) {
    // 2. Fallback jika kena WAF
    if (
      err.message === 'DOLA_WAF_RATE_LIMIT' ||
      err.code === 710022004 ||
      String(err).includes('rate limited') ||
      String(err).includes('STREAM_ERROR') ||
      String(err).includes('shark_admin')
    ) {
      console.warn('[weavy-dola] 🛡️ Proteksi WAF aktif pada gambar. Mengalihkan ke mode tab otomatis...');
      onProgress(30, 'Proteksi anti-bot Dola aktif. Mengalihkan ke mode tab otomatis...');

      return await executeDolaViaTabAutomation({
        prompt: formattedPrompt,
        modelName,
        modelValue,
        ratio: aspectRatio,
        duration: 10,
        referenceAssets,
        isVideo: false,
        onProgress,
      });
    }

    console.warn('[weavy-dola] Error atau WAF pada silent image generation, beralih ke Fallback Tab Otomatis:', err);
    onProgress(30, 'Mengalihkan ke mode tab otomatis cadangan...');
    return await executeDolaViaTabAutomation({
      prompt: formattedPrompt,
      modelName,
      modelValue,
      ratio: aspectRatio,
      duration: 10,
      referenceAssets,
      isVideo: false,
      onProgress,
    });
  }

  // Fallback jika timeout polling
  console.warn('[weavy-dola] Polling silent timeout, mencoba fallback Tab Otomatis...');
  return await executeDolaViaTabAutomation({
    prompt: formattedPrompt,
    modelName,
    modelValue,
    ratio: aspectRatio,
    duration: 10,
    referenceAssets,
    isVideo: false,
    onProgress,
  });
}

// -----------------------------------------------------------------------------
// Dola AI Conversational Chat Integration (⚡ Fast & 💎 Pro)
// -----------------------------------------------------------------------------

export async function modifyDolaConversationModel({ conversationId, isPro, browserCtx }) {
  if (!conversationId) return false;
  try {
    const ctx = browserCtx || await getDolaBrowserContext();
    const url = new URL('https://www.dola.com/im/conversation/modify');
    url.searchParams.set('version_code', '20800');
    url.searchParams.set('language', 'en');
    url.searchParams.set('device_platform', 'web');
    url.searchParams.set('doubao_device_platform', 'web');
    url.searchParams.set('aid', '495671');
    url.searchParams.set('real_aid', '495671');
    url.searchParams.set('pkg_type', 'release_version');
    url.searchParams.set('pc_version', '3.38.0');
    url.searchParams.set('doubao_pc_version', '3.38.0');
    url.searchParams.set('region', 'ID');
    url.searchParams.set('sys_region', 'ID');
    url.searchParams.set('samantha_web', '1');
    url.searchParams.set('web_platform', 'browser');
    url.searchParams.set('use-olympus-account', '1');
    if (ctx.deviceId) url.searchParams.set('device_id', ctx.deviceId);
    if (ctx.web_id) url.searchParams.set('web_id', ctx.web_id);
    if (ctx.tea_uuid) url.searchParams.set('tea_uuid', ctx.tea_uuid);
    url.searchParams.set('web_tab_id', typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tab_${Date.now()}`);

    const body = {
      cmd: 1114,
      uplink_body: {
        modify_conversation_uplink_body: {
          conversation_id: String(conversationId),
          conversation_type: 3,
          bot_conversation_type: 3,
          model_item_key: isPro ? '4' : '0',
        },
      },
      sequence_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `seq_${Date.now()}`,
      channel: 2,
      version: '1',
    };

    const resp = await fetch(url.toString(), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json; encoding=utf-8',
        'agw-js-conv': 'str',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.dola.com',
        'Referer': 'https://www.dola.com/',
      },
      body: JSON.stringify(body),
    });
    return resp.ok;
  } catch (err) {
    console.warn('[weavy-dola-chat] modify conversation model warning:', err);
    return false;
  }
}

function cleanDolaVideoUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  return rawUrl
    .replace(/lr=[^&]+/g, 'lr=unwatermarked')
    .replace(/[?&]download=true/g, '');
}

export function extractDolaVideoUrl(vObj) {
  if (!vObj) return '';
  if (typeof vObj === 'string') {
    if (vObj.startsWith('http')) return cleanDolaVideoUrl(vObj);
    try {
      const decoded = atob(vObj);
      if (decoded && decoded.startsWith('http')) return cleanDolaVideoUrl(decoded);
    } catch (_) {}
  }
  if (typeof vObj !== 'object') return '';

  // 1. Direct url fields
  const directCandidates = [
    vObj.play_url,
    vObj.download_url,
    vObj.video_url,
    vObj.url,
    vObj.main_url,
    vObj.origin_url,
    vObj.raw_url,
    vObj.video_play_url,
    vObj.file_url,
  ];
  for (const cand of directCandidates) {
    if (cand && typeof cand === 'string') {
      if (cand.startsWith('http')) return cleanDolaVideoUrl(cand);
      try {
        const dec = atob(cand);
        if (dec && dec.startsWith('http')) return cleanDolaVideoUrl(dec);
      } catch (_) {}
    }
  }

  // 2. Inspect video_model (JSON string or object)
  if (vObj.video_model) {
    try {
      const vm = typeof vObj.video_model === 'string' ? JSON.parse(vObj.video_model) : vObj.video_model;
      if (vm) {
        if (vm.video_list && typeof vm.video_list === 'object') {
          for (const key of ['video_1', 'video_2', 'video_0', ...Object.keys(vm.video_list)]) {
            const vTarget = vm.video_list[key];
            if (vTarget) {
              const urls = [vTarget.main_url, vTarget.backup_url_1, vTarget.backup_url_2, vTarget.download_url, vTarget.play_url];
              for (const u of urls) {
                if (u && typeof u === 'string') {
                  if (u.startsWith('http')) return cleanDolaVideoUrl(u);
                  try {
                    const dec = atob(u);
                    if (dec && dec.startsWith('http')) return cleanDolaVideoUrl(dec);
                  } catch (_) {}
                }
              }
            }
          }
        }
        const vmDirect = [vm.main_url, vm.play_url, vm.download_url, vm.video_url];
        for (const u of vmDirect) {
          if (u && typeof u === 'string') {
            if (u.startsWith('http')) return cleanDolaVideoUrl(u);
            try {
              const dec = atob(u);
              if (dec && dec.startsWith('http')) return cleanDolaVideoUrl(dec);
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }

  return '';
}

export function extractDolaMessagePayload(rawContentOrBlocks) {
  if (!rawContentOrBlocks) return { text: '', images: [], videos: [] };
  let blocks = [];
  try {
    blocks = typeof rawContentOrBlocks === 'string' ? JSON.parse(rawContentOrBlocks) : rawContentOrBlocks;
    if (!Array.isArray(blocks)) blocks = [blocks];
  } catch (_) {
    return { text: typeof rawContentOrBlocks === 'string' ? rawContentOrBlocks : '', images: [], videos: [] };
  }

  const texts = [];
  const images = [];
  const videos = [];

  const processBlock = (b) => {
    if (!b) return;
    if (typeof b === 'string') {
      if (b.trim()) texts.push(b.trim());
      return;
    }
    const bContent = b.content || b;
    if (typeof bContent === 'string') {
      if (bContent.trim()) texts.push(bContent.trim());
      return;
    }
    if (bContent.text_block?.text) {
      texts.push(bContent.text_block.text);
    }
    if (typeof bContent.text === 'string' && bContent.text) {
      texts.push(bContent.text);
    }
    if (typeof bContent.markdown === 'string' && bContent.markdown) {
      texts.push(bContent.markdown);
    } else if (bContent.markdown?.text) {
      texts.push(bContent.markdown.text);
    }
    if (typeof bContent.rich_text === 'string' && bContent.rich_text) {
      texts.push(bContent.rich_text);
    } else if (bContent.rich_text?.text) {
      texts.push(bContent.rich_text.text);
    }
    if (bContent.table_block?.table_data && Array.isArray(bContent.table_block.table_data)) {
      try {
        const rows = bContent.table_block.table_data;
        if (rows.length > 0) {
          const tableMd = rows.map((r, i) => {
            const cells = Array.isArray(r) ? r : Object.values(r);
            const rowStr = `| ${cells.map((c) => String(c || '').replace(/\|/g, '\\|').trim()).join(' | ')} |`;
            if (i === 0) {
              const divStr = `| ${cells.map(() => '---').join(' | ')} |`;
              return `${rowStr}\n${divStr}`;
            }
            return rowStr;
          }).join('\n');
          texts.push(tableMd);
        }
      } catch (_) {}
    }

    // Check direct video blocks
    const directVideo = bContent.video_block || bContent.video || bContent.ai_video || b.video_block || b.video;
    if (directVideo) {
      const vUrl = extractDolaVideoUrl(directVideo);
      if (vUrl && !videos.includes(vUrl)) {
        videos.push(vUrl);
      }
    }

    const crBlock = bContent.creation_block || {};
    const creations = crBlock.creations || [];
    for (const cr of creations) {
      // Check if creation is video (type === 2 or has video field)
      const isVideoType = cr.type === 2 || !!cr.video;
      if (isVideoType) {
        const vidUrl = extractDolaVideoUrl(cr.video || cr);
        if (vidUrl && !videos.includes(vidUrl)) {
          videos.push(vidUrl);
        }
        // Do NOT add cr.image as standalone picture because it is the video poster/thumbnail!
        continue;
      }

      // Check if creation is image (type === 1 or has image field)
      if (cr.type === 1 || cr.image) {
        const img = cr.image || {};
        const url = img.image_ori?.url || img.image_preview?.url || img.image_thumb?.url || img.url || '';
        if (url && url.startsWith('http')) {
          const cleanUrl = cleanByteDanceCdnImageUrl(url);
          if (!images.includes(cleanUrl)) images.push(cleanUrl);
        }
      }
    }
  };

  for (const b of blocks) {
    processBlock(b);
  }

  // Scan raw text for unescaped video URLs (e.g. bytevcloud, .mp4, tos-alisg)
  for (const t of texts) {
    if (typeof t === 'string') {
      const mp4Matches = t.match(/https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov)(?:\?[^\s"'<>]*)?/gi);
      if (mp4Matches) {
        for (const mUrl of mp4Matches) {
          const cleaned = cleanDolaVideoUrl(mUrl);
          if (cleaned && !videos.includes(cleaned)) videos.push(cleaned);
        }
      }
    }
  }

  let formatted = texts.join('\n\n').trim();
  for (const vid of videos) {
    if (!formatted.includes(`[weavy_repost_video:${vid}]`)) {
      formatted = `${formatted}\n\n[weavy_repost_video:${vid}]`.trim();
    }
  }
  for (const img of images) {
    if (!formatted.includes(`[weavy_repost:${img}]`)) {
      formatted = `${formatted}\n\n[weavy_repost:${img}]`.trim();
    }
  }

  return { text: formatted, images, videos };
}

async function pollRecentChatConv({ targetConvId, conversationId, minCreateTimeSec = 0, lastMessageIndex = 0 }) {
  const effectiveConvId = targetConvId || conversationId || '';
  // JANGAN PERNAH mengambil percakapan secara acak jika ID percakapan tidak ada / belum diketahui!
  if (!effectiveConvId) return null;

  const browserCtx = await getDolaBrowserContext();
  const pollUrl = new URL('https://www.dola.com/im/chain/recent_conv');
  pollUrl.searchParams.set('version_code', '20800');
  pollUrl.searchParams.set('language', 'en');
  pollUrl.searchParams.set('device_platform', 'web');
  pollUrl.searchParams.set('doubao_device_platform', 'web');
  pollUrl.searchParams.set('aid', '495671');
  pollUrl.searchParams.set('real_aid', '495671');
  pollUrl.searchParams.set('pkg_type', 'release_version');
  pollUrl.searchParams.set('pc_version', '3.38.0');
  pollUrl.searchParams.set('doubao_pc_version', '3.38.0');
  pollUrl.searchParams.set('region', 'ID');
  pollUrl.searchParams.set('sys_region', 'ID');
  pollUrl.searchParams.set('samantha_web', '1');
  pollUrl.searchParams.set('web_platform', 'browser');
  pollUrl.searchParams.set('use-olympus-account', '1');
  if (browserCtx.deviceId) pollUrl.searchParams.set('device_id', browserCtx.deviceId);
  if (browserCtx.web_id) pollUrl.searchParams.set('web_id', browserCtx.web_id);
  if (browserCtx.tea_uuid) pollUrl.searchParams.set('tea_uuid', browserCtx.tea_uuid);
  if (browserCtx.fp) pollUrl.searchParams.set('fp', browserCtx.fp);

  const pollBody = {
    cmd: 3200,
    uplink_body: {
      pull_recent_conv_chain_uplink_body: {
        limit: 5,
        filter: { conversation_type: [], project_filter: 1 },
        message_count_per_conv: 6,
        api_version: 1,
        conv_version: 0,
        direction: 3,
        option: {
          not_need_message: false,
          need_complete_conversation: true,
          need_coco_bot: true,
          need_pc_pin_chain: true,
          pc_pin_query_type: 1,
          exclude_archive: true,
          only_archive: false,
        },
      },
    },
    sequence_id: `seq_${Date.now()}`,
    channel: 2,
    version: '1',
  };

  try {
    const resp = await fetch(pollUrl.toString(), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json; encoding=utf-8',
        'agw-js-conv': 'str',
        'Accept': '*/*',
        'Origin': 'https://www.dola.com',
        'Referer': 'https://www.dola.com/',
      },
      body: JSON.stringify(pollBody),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const cells = data?.downlink_body?.pull_recent_conv_chain_downlink_body?.cells || [];

    for (const c of cells) {
      const conv = c.conversation || {};
      const convId = String(conv.conversation_id || '');
      // Pastikan hanya membaca pesan dari percakapan yang cocok dengan target
      if (convId !== String(effectiveConvId)) continue;

      for (const m of (conv.messages || []).slice().reverse()) {
        if (m.user_type === 2 || m.sender_type === 2 || m.role === 'assistant') {
          const rawTime = m.create_time ? Number(m.create_time) : 0;
          const mTime = rawTime > 1e11 ? Math.floor(rawTime / 1000) : rawTime;
          if (minCreateTimeSec && (!mTime || mTime < minCreateTimeSec)) continue;
          if (lastMessageIndex && m.message_index && m.message_index <= lastMessageIndex) continue;

          const content = m.content || '';
          if (content) {
            const parsed = extractDolaMessagePayload(content);
            if (parsed.text || parsed.images.length > 0 || parsed.videos.length > 0) {
              return { text: parsed.text, images: parsed.images, videos: parsed.videos, convId: convId || effectiveConvId };
            }
          }
          if (Array.isArray(m.content_block)) {
            const parsed = extractDolaMessagePayload(m.content_block);
            if (parsed.text || parsed.images.length > 0 || parsed.videos.length > 0) {
              return { text: parsed.text, images: parsed.images, videos: parsed.videos, convId: convId || effectiveConvId };
            }
          }
        }
      }
    }
  } catch (_) {}
  return null;
}

async function executeDolaChatViaTab({
  prompt,
  isPro = false,
  referenceAssets = [],
  conversationId = null,
  onProgress = () => {},
  onChunk = () => {},
}) {
  onProgress(25, 'Mempersiapkan tab Dola AI di background...');
  const { tab } = await getOrOpenDolaTab();

  // Jika ada target percakapan spesifik dan tab belum membuka ID percakapan tersebut, navigasi tab terlebih dahulu
  if (conversationId && tab?.id) {
    try {
      const currentTabUrl = tab.url || '';
      if (!currentTabUrl.includes(conversationId)) {
        await chrome.tabs.update(tab.id, { url: `https://www.dola.com/chat/${conversationId}` });
        await waitForDolaTabReady(tab.id, 8000).catch(() => {});
      }
    } catch (navErr) {
      console.warn('[weavy-dola-chat] Gagal mengarahkan tab ke percakapan lama:', navErr);
    }
  } else if (!conversationId && tab?.id) {
    // Sesi baru (pertama kali chat): Jika tab saat ini sedang membuka percakapan spesifik (/chat/[id]),
    // arahkan kembali ke https://www.dola.com/chat agar tab bersih dari riwayat dan gambar lama
    try {
      const currentTabUrl = tab.url || '';
      if (currentTabUrl.match(/\/chat\/\d+/)) {
        await chrome.tabs.update(tab.id, { url: 'https://www.dola.com/chat' });
        await waitForDolaTabReady(tab.id, 8000).catch(() => {});
      }
    } catch (navErr) {
      console.warn('[weavy-dola-chat] Gagal mengarahkan tab ke chat baru:', navErr);
    }
  }

  const referenceFiles = [];
  const seenFileKeys = new Set();
  for (const asset of (referenceAssets || []).filter((item) => item?.type !== 'video').slice(0, 3)) {
    try {
      const parsed = await assetToBytes(asset);
      const dataUrl = parsed.dataUrl?.startsWith('data:')
        ? parsed.dataUrl
        : bytesToDataUrl(parsed.bytes, parsed.mime);
      const fileKey = `${parsed.bytes?.length || 0}_${dataUrl.slice(0, 60)}_${dataUrl.slice(-30)}`;
      if (!seenFileKeys.has(fileKey)) {
        seenFileKeys.add(fileKey);
        referenceFiles.push({
          name: ensureImageFilename(parsed.filename, parsed.ext, parsed.mime),
          dataUrl,
        });
      }
    } catch (error) {
      console.warn('[weavy-dola-chat] Gagal menyiapkan gambar attachment:', error);
    }
  }

  onProgress(35, `Mengalihkan mode ke Dola AI (${isPro ? '💎 Pro' : '⚡ Fast'})...`);

  const injectionResult = await executeInDolaTab(
    tab.id,
    async (taskPrompt, isTargetPro, taskRefImages, targetConversationId) => {
      try {
        const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

        const findDolaModeTriggerFromDom = (doc = document) => {
          return (
            doc.querySelector('[data-valid-btn="mode-select-action-btn"]') ||
            doc.querySelector('[data-slot="dropdown-menu-trigger"]') ||
            doc.querySelector('[data-input-engine-action-source="actionbar"] [aria-haspopup="menu"]') ||
            doc.querySelector('[data-testid="mode-select-btn"]') ||
            Array.from(doc.querySelectorAll('button, [role="button"], [data-slot="dropdown-menu-trigger"], [aria-haspopup="menu"]')).find((el) => {
              const text = (el.innerText || el.textContent || '').trim().toLowerCase();
              return (text === 'fast' || text === 'pro' || text.startsWith('fast') || text.startsWith('pro')) && !text.includes('create');
            })
          );
        };

        const findDolaModeMenuItemFromDom = (doc = document, isTargetPro = false) => {
          const menuItems = Array.from(doc.querySelectorAll(
            '[role="menuitem"], [data-slot="dropdown-menu-item"], [data-radix-collection-item], [data-tier]'
          )).filter((item) => {
            const rect = item.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && getComputedStyle(item).visibility !== 'hidden';
          });

          const matchedBySelection = menuItems.find((item) => {
            const text = (item.innerText || item.textContent || '').trim().toLowerCase();
            const value = (item.getAttribute('data-value') || item.getAttribute('data-tier') || '').toLowerCase();
            const selected = item.getAttribute('data-selected') === 'true' || item.getAttribute('aria-checked') === 'true';
            const hasFast = /fast/.test(text) || /fast/.test(value);
            const hasPro = /\bpro\b/.test(text) || /\bpro\b/.test(value);
            return selected && ((isTargetPro && hasPro) || (!isTargetPro && hasFast));
          });

          if (matchedBySelection) return matchedBySelection;

          return menuItems.find((item) => {
            const text = (item.innerText || item.textContent || '').trim().toLowerCase();
            const value = (item.getAttribute('data-value') || item.getAttribute('data-tier') || '').toLowerCase();
            const hasFast = /fast/.test(text) || /fast/.test(value);
            const hasPro = /\bpro\b/.test(text) || /\bpro\b/.test(value);
            return (isTargetPro && hasPro && !hasFast) || (!isTargetPro && hasFast && !hasPro);
          }) || menuItems.find((item) => {
            const text = (item.innerText || item.textContent || '').trim().toLowerCase();
            const value = (item.getAttribute('data-value') || item.getAttribute('data-tier') || '').toLowerCase();
            const hasFast = /fast/.test(text) || /fast/.test(value);
            const hasPro = /\bpro\b/.test(text) || /\bpro\b/.test(value);
            return (isTargetPro && hasPro) || (!isTargetPro && hasFast);
          });
        };

        const triggerFullClick = (el) => {
          if (!el) return;
          try {
            el.scrollIntoView?.({ block: 'center', inline: 'center' });
            el.focus?.();
          } catch (_) {}
          try {
            const reactKey = Object.keys(el).find((k) =>
              k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$')
            );
            if (reactKey && el[reactKey]) {
              const p = el[reactKey];
              if (typeof p.onPointerDown === 'function') p.onPointerDown({ preventDefault: () => {}, stopPropagation: () => {}, target: el, currentTarget: el });
              if (typeof p.onClick === 'function') p.onClick({ preventDefault: () => {}, stopPropagation: () => {}, target: el, currentTarget: el });
            }
          } catch (_) {}
          const rect = el.getBoundingClientRect();
          const evtOpts = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
          el.dispatchEvent(new PointerEvent('pointerdown', evtOpts));
          el.dispatchEvent(new MouseEvent('mousedown', evtOpts));
          el.dispatchEvent(new PointerEvent('pointerup', evtOpts));
          el.dispatchEvent(new MouseEvent('mouseup', evtOpts));
          el.dispatchEvent(new MouseEvent('click', evtOpts));
          try {
            el.click();
          } catch (_) {}
        };

        const clickDolaModeElement = (el) => {
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const eventOptions = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            button: 0,
          };
          el.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
          el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
          el.dispatchEvent(new PointerEvent('pointerup', eventOptions));
          el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
          el.dispatchEvent(new MouseEvent('click', eventOptions));
        };

        // 1. Klik New Chat jika belum ada sesi / percakapan baru, atau arahkan ke percakapan target
        if (!targetConversationId) {
          const findNewChatBtn = () => {
            const direct = document.querySelector('[data-testid="new-chat-button"]') ||
              document.querySelector('button[data-testid="new-chat-btn"]');
            if (direct) return direct;

            const buttons = Array.from(document.querySelectorAll('button, div[role="button"], a[href*="/chat"], [role="link"]'));
            return buttons.find((b) => {
              const aria = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
              if (aria.includes('new chat') || aria.includes('create chat') || aria.includes('compose') || aria.includes('chat baru')) return true;
              const t = (b.innerText || b.textContent || '').trim().toLowerCase();
              if (t === 'new chat' || t === 'chat baru' || t === '+ new chat' || t === 'percakapan baru') return true;
              const paths = Array.from(b.querySelectorAll('svg path'));
              return paths.some((p) => {
                const d = p.getAttribute('d') || '';
                return d.includes('1.99882') || d.includes('17.0459') || d.includes('11.5867') || d.includes('13.4549');
              });
            });
          };
          const newChat = findNewChatBtn();
          const hasExistingMessages = !!document.querySelector('.creation_block, [data-message-id], div[class*="message-item"], [data-slot="message"]');
          if (newChat && (hasExistingMessages || (window.location.pathname && window.location.pathname.length > 6))) {
            triggerFullClick(newChat);
            // Tunggu hingga percakapan lama benar-benar bersih dari DOM (maksimal 2 detik)
            for (let w = 0; w < 10; w++) {
              await waitMs(200);
              const stillHasMessages = !!document.querySelector('.creation_block, [data-message-id], div[class*="message-item"], [data-slot="message"]');
              if (!stillHasMessages) break;
            }
          }
        } else {
          // Navigasi ke percakapan target sudah ditangani sebelum injeksi script
        }

        // 2. Switch Mode Fast vs Pro
        const modeTrigger = findDolaModeTriggerFromDom(document);
        if (modeTrigger) {
          const currentModeText = (modeTrigger.innerText || modeTrigger.textContent || '').trim().toLowerCase();
          const hasTargetModeText = isTargetPro ? currentModeText.includes('pro') : currentModeText.includes('fast');
          const needsModeSwitch = !hasTargetModeText;

          if (needsModeSwitch) {
            const triggerTarget = modeTrigger.querySelector('button, [role="button"]') || modeTrigger;
              clickDolaModeElement(triggerTarget);

            let targetModeItem = null;
            for (let attempt = 0; attempt < 12; attempt += 1) {
              targetModeItem = findDolaModeMenuItemFromDom(document, isTargetPro);
              if (targetModeItem) break;
              await waitMs(150);
            }

            if (!targetModeItem) {
              return { success: false, error: `Menu mode Dola (${isTargetPro ? 'Pro' : 'Fast'}) tidak muncul.` };
            }

            const expectedMode = isTargetPro ? 'pro' : 'fast';
            let modeActivated = false;
              for (let retry = 0; retry < 2 && !modeActivated; retry += 1) {
                const currentModeItem = findDolaModeMenuItemFromDom(document, isTargetPro) || targetModeItem;
                clickDolaModeElement(currentModeItem);
                for (let attempt = 0; attempt < 12; attempt += 1) {
                  const updatedModeTrigger = findDolaModeTriggerFromDom(document) || modeTrigger;
                  const updatedModeText = (updatedModeTrigger.innerText || updatedModeTrigger.textContent || '').trim().toLowerCase();
                  if (updatedModeText.includes(expectedMode)) {
                    modeActivated = true;
                    break;
                  }
                  await waitMs(150);
                }
                if (!modeActivated && retry === 0) {
                  const retryTrigger = findDolaModeTriggerFromDom(document);
                  const retryTarget = retryTrigger?.querySelector('button, [role="button"]') || retryTrigger;
                  clickDolaModeElement(retryTarget);
                  await waitMs(150);
              }
            }

            if (!modeActivated) {
              return { success: false, error: `Mode Dola belum berubah ke ${isTargetPro ? 'Pro' : 'Fast'}.` };
            }
          }
        }

        // 3. Cari editor teks & isi prompt (TipTap / ProseMirror / textarea)
        const findInput = () => {
          return (
            document.querySelector('div.tiptap.ProseMirror') ||
            document.querySelector('#input-engine-container [contenteditable="true"]') ||
            document.querySelector('#flow-end-msg-input') ||
            document.querySelector('[data-testid="chat-input"]') ||
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('textarea#input-engine-textarea') ||
            document.querySelector('textarea')
          );
        };

        const inputEl = findInput();
        if (!inputEl) return { success: false, error: 'Editor chat Dola tidak ditemukan di tab.' };

        inputEl.focus();
        // Bersihkan seluruh teks / draft lama secara menyeluruh (baik ProseMirror maupun textarea)
        try {
          const selection = window.getSelection();
          if (selection) {
            selection.selectAllChildren(inputEl);
            document.execCommand('delete', false, null);
          }
        } catch (_) {}
        try {
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
        } catch (_) {}

        if (inputEl.isContentEditable) {
          inputEl.innerHTML = '';
        } else {
          inputEl.value = '';
        }
        inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }));

        let inserted = false;
        try {
          inserted = document.execCommand('insertText', false, taskPrompt);
        } catch (_) {}

        if (!inserted || !inputEl.textContent.trim()) {
          try {
            const textTransfer = new DataTransfer();
            textTransfer.setData('text/plain', taskPrompt);
            inputEl.dispatchEvent(new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: textTransfer,
            }));
          } catch (_) {}
        }

        if (!inputEl.textContent.trim()) {
          if (inputEl.isContentEditable) {
            inputEl.innerHTML = `<p>${taskPrompt.replace(/\n/g, '<br>')}</p>`;
          } else {
            inputEl.value = taskPrompt;
          }
        }

        inputEl.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: taskPrompt,
        }));
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));

        if (taskRefImages && taskRefImages.length > 0) {
          const dataTransfer = new DataTransfer();
          for (let i = 0; i < taskRefImages.length; i++) {
            const item = taskRefImages[i];
            const parts = (item.dataUrl || '').split(',');
            if (parts.length !== 2) continue;
            const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const binary = atob(parts[1]);
            const bytes = new Uint8Array(binary.length);
            for (let b = 0; b < binary.length; b += 1) bytes[b] = binary.charCodeAt(b);
            dataTransfer.items.add(new File([bytes], item.name || `chat-ref-${i + 1}.jpg`, { type: mime }));
          }

          if (dataTransfer.files.length > 0) {
            let uploaded = false;
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
              try {
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                uploaded = true;
              } catch (_) {}
            }

            if (!uploaded) {
              try {
                const pasteEvent = new ClipboardEvent('paste', {
                  bubbles: true,
                  cancelable: true,
                  clipboardData: dataTransfer,
                });
                inputEl.dispatchEvent(pasteEvent);
              } catch (_) {}
            }

            // Tunggu upload thumbnail selesai (maksimal 6 detik)
            for (let w = 0; w < 12; w++) {
              await waitMs(500);
              const spinners = document.querySelectorAll(
                '#input-engine-container [class*="spin"], #input-engine-container [class*="loading"], #input-engine-container [class*="progress"]'
              );
              if (spinners.length === 0) break;
            }
          }
        }
        await waitMs(350);

        // 4. Klik tombol Send
        const findSendBtn = () => {
          return (
            document.getElementById('flow-end-msg-send') ||
            document.querySelector('#flow-end-msg-send') ||
            document.querySelector('.send-btn-wrapper button') ||
            document.querySelector('button[data-testid="chat-input-send-button"]') ||
            document.querySelector('button[data-testid="send-button"]') ||
            document.querySelector('button[data-testid*="send"]') ||
            Array.from(document.querySelectorAll('#input-engine-container button, button')).find((btn) => {
              const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
              const id = (btn.id || '').toLowerCase();
              const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
              return (id.includes('send') || aria.includes('send') || aria.includes('kirim') || testId.includes('send')) && !btn.disabled;
            })
          );
        };

        // Tunggu tombol send enabled
        let sendBtn = findSendBtn();
        for (let w = 0; w < 10; w++) {
          if (sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true' && sendBtn.getAttribute('data-disabled') !== 'true') {
            break;
          }
          await waitMs(200);
          sendBtn = findSendBtn();
        }

        // Simpan baseline snapshot pesan SEBELUM kirim
        const preMessageElements = Array.from(document.querySelectorAll(
          '[data-slot="message"], [data-message-id], [class*="message-item"], [class*="chat-message"], [data-testid="message-item"], [data-testid="message-content"]'
        ));
        const preMessageIds = preMessageElements.map((el, i) => el.getAttribute('data-message-id') || el.id || `msg_pre_${i}`);
        const preMessageCount = preMessageElements.length;

        if (sendBtn) {
          triggerFullClick(sendBtn);
          const inner = sendBtn.querySelector('svg, div');
          if (inner) triggerFullClick(inner);
        } else {
          // Fallback Enter key
          inputEl.focus();
          inputEl.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
          }));
        }

        return { success: true, preMessageCount, preMessageIds, sentTimestamp: Date.now() };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [prompt, isPro, referenceFiles, conversationId],
    'MAIN'
  );

  const tabRes = injectionResult?.[0]?.result ?? injectionResult;
  if (!tabRes?.success) {
    throw new Error(tabRes?.error || 'Gagal mengirim chat ke tab Dola AI.');
  }

  const initialMsgCount = tabRes?.preMessageCount || 0;
  const initialMsgIds = new Set(tabRes?.preMessageIds || []);
  const sentTimestamp = tabRes?.sentTimestamp || Date.now();

  onProgress(50, 'Menunggu balasan dari Dola AI...');
  onChunk('[chat_typing_loader]');

  const startTime = Date.now();
  let lastText = '';
  let lastThinking = '';
  let stableResponseCount = 0;
  let lastResponseSignature = '';

  while (Date.now() - startTime < 120000) {
    await new Promise((r) => setTimeout(r, 1200));

    const pollResult = await executeInDolaTab(
      tab.id,
      (userPrompt, minMsgCount, preIdsArray) => {
        const preIdSet = new Set(preIdsArray || []);

        // Helper untuk mengkonversi node HTML (termasuk Table, Heading, List) ke teks Markdown murni yang rapi
        const convertNodeToMarkdown = (node) => {
          if (!node) return '';

          // Clone node untuk manipulasi tanpa merusak tampilan tab Dola
          const clone = node.cloneNode(true);

          // Hapus elemen UI yang tidak diinginkan (toolbar, tombol aksi, feedback, avatar, timestamp, cursor typing)
          const unwantedSelectors = [
            'button',
            'svg',
            '[role="button"]',
            '[class*="toolbar"]',
            '[class*="action"]',
            '[class*="feedback"]',
            '[class*="copy"]',
            '[class*="retry"]',
            '[class*="regenerate"]',
            '[class*="avatar"]',
            '[class*="timestamp"]',
            '[class*="time"]',
            '[class*="typing"]',
            '[class*="cursor-blink"]',
            '[class*="generating"]',
            '.animate-spin',
            '[data-slot="message-actions"]',
          ];
          try {
            clone.querySelectorAll(unwantedSelectors.join(', ')).forEach((el) => el.remove());
          } catch (_) {}

          // 1. Tangani konversi elemen TABLE menjadi GFM Markdown Table
          const tableElements = Array.from(clone.querySelectorAll('table'));
          for (const table of tableElements) {
            const trRows = Array.from(table.querySelectorAll('tr'));
            if (trRows.length === 0) continue;

            const mdRows = [];
            let headerProcessed = false;

            for (let rIdx = 0; rIdx < trRows.length; rIdx++) {
              const tr = trRows[rIdx];
              const cells = Array.from(tr.querySelectorAll('th, td'));
              if (cells.length === 0) continue;

              const cellTexts = cells.map((cell) => {
                const cellClone = cell.cloneNode(true);
                cellClone.querySelectorAll('button, svg, [role="button"]').forEach((e) => e.remove());
                return (cellClone.innerText || cellClone.textContent || '').trim().replace(/\|/g, '\\|').replace(/\r?\n+/g, ' ');
              });

              mdRows.push(`| ${cellTexts.join(' | ')} |`);

              // Jika row pertama adalah th atau header table
              const isHeaderRow = rIdx === 0 || tr.querySelector('th') !== null || tr.closest('thead') !== null;
              if (isHeaderRow && !headerProcessed) {
                const dividerCells = cells.map(() => '---');
                mdRows.push(`| ${dividerCells.join(' | ')} |`);
                headerProcessed = true;
              }
            }

            if (!headerProcessed && mdRows.length > 0) {
              const colCount = trRows[0].querySelectorAll('th, td').length;
              const dividerCells = Array.from({ length: colCount }, () => '---');
              mdRows.splice(1, 0, `| ${dividerCells.join(' | ')} |`);
            }

            const markdownTable = `\n\n${mdRows.join('\n')}\n\n`;
            const replacementTextNode = document.createTextNode(markdownTable);
            table.parentNode?.replaceChild(replacementTextNode, table);
          }

          // 2. Tangani Heading (H1 - H6)
          for (let h = 1; h <= 6; h++) {
            const hElements = Array.from(clone.querySelectorAll(`h${h}`));
            for (const hEl of hElements) {
              const hText = (hEl.innerText || hEl.textContent || '').trim();
              if (hText) {
                const prefix = '#'.repeat(h);
                const replacementNode = document.createTextNode(`\n\n${prefix} ${hText}\n\n`);
                hEl.parentNode?.replaceChild(replacementNode, hEl);
              }
            }
          }

          // 3. Tangani Bullet Lists (UL, OL)
          const listElements = Array.from(clone.querySelectorAll('ul, ol'));
          for (const listEl of listElements) {
            const isOrdered = listEl.tagName.toLowerCase() === 'ol';
            const liItems = Array.from(listEl.querySelectorAll(':scope > li, li'));
            const listLines = [];
            liItems.forEach((li, idx) => {
              const liClone = li.cloneNode(true);
              liClone.querySelectorAll('ul, ol, button, svg').forEach((e) => e.remove());
              const liText = (liClone.innerText || liClone.textContent || '').trim();
              if (liText) {
                listLines.push(isOrdered ? `${idx + 1}. ${liText}` : `- ${liText}`);
              }
            });
            if (listLines.length > 0) {
              const replacementNode = document.createTextNode(`\n\n${listLines.join('\n')}\n\n`);
              listEl.parentNode?.replaceChild(replacementNode, listEl);
            }
          }

          // 4. Tangani Code Blocks (PRE, CODE)
          const preElements = Array.from(clone.querySelectorAll('pre'));
          for (const pre of preElements) {
            const codeEl = pre.querySelector('code');
            const codeText = (codeEl ? codeEl.textContent : pre.textContent) || '';
            let lang = '';
            const classMatch = (codeEl?.className || pre.className || '').match(/language-([a-zA-Z0-9_-]+)/i);
            if (classMatch) {
              lang = classMatch[1];
            } else {
              // Cek parent / sibling container untuk header bahasa seperti di UI Dola AI
              const container = pre.closest('[class*="code"], [class*="block"], div');
              const headerEl = container?.querySelector('[class*="header"], [class*="title"], [class*="lang"], span');
              const headerText = (headerEl?.textContent || '').trim().toLowerCase();
              if (headerText.includes('storyboard')) lang = 'storyboard_project';
              else if (headerText.includes('json')) lang = 'json';
              else if (headerText.includes('javascript') || headerText.includes('js')) lang = 'javascript';
            }

            if (!lang) {
              if (
                codeText.includes('"sceneNumber"') ||
                codeText.includes('"scenes"') ||
                codeText.includes('"visualDescription"') ||
                codeText.includes('storyboard_project')
              ) {
                lang = 'storyboard_project';
              } else if (codeText.trim().startsWith('{') || codeText.trim().startsWith('[')) {
                lang = 'json';
              }
            }

            const replacementNode = document.createTextNode(`\n\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n\n`);
            pre.parentNode?.replaceChild(replacementNode, pre);
          }

          // 5. Tangani Blockquotes
          const blockquotes = Array.from(clone.querySelectorAll('blockquote'));
          for (const bq of blockquotes) {
            const bqText = (bq.innerText || bq.textContent || '').trim();
            if (bqText) {
              const formattedBq = bqText.split('\n').map((l) => `> ${l}`).join('\n');
              const replacementNode = document.createTextNode(`\n\n${formattedBq}\n\n`);
              bq.parentNode?.replaceChild(replacementNode, bq);
            }
          }

          // 6. Tangani Links (A)
          const linkElements = Array.from(clone.querySelectorAll('a[href]'));
          for (const link of linkElements) {
            const href = link.getAttribute('href');
            const linkText = (link.innerText || link.textContent || '').trim();
            if (href && linkText && !href.startsWith('javascript:')) {
              const replacementNode = document.createTextNode(`[${linkText}](${href})`);
              link.parentNode?.replaceChild(replacementNode, link);
            }
          }

          // Ambil innerText akhir dari clone
          let resultText = (clone.innerText || clone.textContent || '').trim();

          // Bersihkan excessive empty newlines
          resultText = resultText.replace(/\n{3,}/g, '\n\n');

          return resultText;
        };

        // Layer 1: Deteksi Role Semantik Pesan (Assistant vs User)
        const getRole = (el) => {
          if (!el || el.nodeType !== 1) return null;
          if (el.closest('#input-engine-container, .guidance-input-container, form, .tiptap')) return null;

          const directRole = (
            el.getAttribute('data-role') ||
            el.getAttribute('data-message-role') ||
            el.getAttribute('data-author') ||
            ''
          ).toLowerCase();
          if (directRole === 'assistant' || directRole === 'bot' || directRole === 'model') return 'assistant';
          if (directRole === 'user') return 'user';

          const testId = (el.getAttribute('data-testid') || el.getAttribute('data-qa') || '').toLowerCase();
          if (testId.includes('assistant') || testId.includes('bot') || testId.includes('agent')) return 'assistant';
          if (testId.includes('user')) return 'user';

          const className = (el.className || '').toString().toLowerCase();
          if (className.includes('agent-message') || className.includes('bot-message') || className.includes('assistant-message')) return 'assistant';
          if (className.includes('user-message') || className.includes('user_message')) return 'user';

          // Memiliki tombol aksi bot khas Dola (copy, thumbs up/down, retry/regenerate, share)
          const hasBotToolbar = !!el.querySelector(
            'button[aria-label*="Copy" i], button[title*="Copy" i], button[aria-label*="Regenerate" i], button[aria-label*="Retry" i], button[title*="Retry" i], button[aria-label*="Like" i], button[aria-label*="Dislike" i], [data-testid*="copy"], [data-testid*="regenerate"], [data-testid*="retry"]'
          );
          if (hasBotToolbar) return 'assistant';

          // Memiliki avatar bot atau class bertanda agent/bot
          const hasBotAvatar = !!el.querySelector('[class*="bot-avatar"], [class*="assistant-avatar"], [class*="agent-avatar"]');
          if (hasBotAvatar) return 'assistant';

          // Cek avatar user atau class alignment user
          const hasUserAvatar = !!el.querySelector('[class*="avatar"]:not([class*="bot"]):not([class*="assistant"]):not([class*="agent"])');
          const isRightAligned = className.includes('justify-end') ||
            className.includes('items-end') ||
            className.includes('flex-row-reverse') ||
            el.classList?.contains('justify-end') ||
            el.classList?.contains('items-end');
          if (hasUserAvatar || isRightAligned) return 'user';

          return null;
        };

        // Layer 2: Kumpulkan semua bubble / turn pesan di percakapan
        const allMessageNodes = Array.from(document.querySelectorAll(
          '[data-slot="message"], [data-message-id], [class*="message-item"], [class*="message_item"], [class*="chat-message"], [class*="chat-item"], [class*="chat_item"], [class*="messageCard"], [class*="message-card"], [class*="msg-item"], [class*="msg_item"], [data-testid*="message"], [data-testid="chat_message_item"], [data-qa*="message"], [class*="agent-message"], [class*="bot-message"], [class*="user-message"], .creation_block'
        )).filter((n) => !n.closest('#input-engine-container, .guidance-input-container, form, .tiptap'));

        let latestBotNode = null;

        // Layer 3: Identifikasi pesan Asisten / Bot Terbaru
        // Strategi A: Cari node terakhir yang secara eksplisit diidentifikasi sebagai assistant
        for (let i = allMessageNodes.length - 1; i >= 0; i--) {
          const node = allMessageNodes[i];
          if (getRole(node) === 'assistant') {
            latestBotNode = node;
            break;
          }
        }

        // Strategi B: Jika tidak ada role eksplisit, cari node terakhir setelah user yang bukan user
        if (!latestBotNode && allMessageNodes.length > 0) {
          for (let i = allMessageNodes.length - 1; i >= 0; i--) {
            const node = allMessageNodes[i];
            const r = getRole(node);
            if (r !== 'user') {
              const nodeText = (node.innerText || node.textContent || '').trim();
              if (nodeText && !nodeText.startsWith('[System Instruction:') && !nodeText.startsWith('[RIWAYAT LENGKAP')) {
                latestBotNode = node;
                break;
              }
            }
          }
        }

        // Strategi C: Direct query ke container markdown respon Dola yang bukan milik user
        if (!latestBotNode) {
          const markdownContainers = Array.from(document.querySelectorAll(
            'div.markdown, div.prose, [class*="markdown_"], [class*="message-content"], [data-slot="message-content"]'
          )).filter((n) => !n.closest('#input-engine-container, form, .tiptap'));

          if (markdownContainers.length > 0) {
            for (let i = markdownContainers.length - 1; i >= 0; i--) {
              const mc = markdownContainers[i];
              const parentCard = mc.closest('[data-slot="message"], [data-message-id], div') || mc;
              if (getRole(parentCard) !== 'user') {
                latestBotNode = mc;
                break;
              }
            }
          }
        }

        let botText = '';
        let thoughtText = '';
        const imageUrls = [];
        let videoUrl = '';

        const latestBotGenerating = latestBotNode && latestBotNode.querySelector(
          '[class*="generating"], [class*="typing"], [class*="cursor-blink"], svg.animate-spin, [data-state="generating"], .dot-flashing'
        );
        const stopButton = document.querySelector(
          '[data-testid="stop-generate-button"], [data-testid*="stop"], button[aria-label*="Stop" i], button[title*="Stop" i], .break-btn-fISNgC:not(.\\!hidden), [class*="break-btn"]:not([class*="hidden"])'
        );
        const stopButtonVisible = stopButton && (() => {
          const rect = stopButton.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && getComputedStyle(stopButton).visibility !== 'hidden';
        })();
        const isGenerating = Boolean(latestBotGenerating || stopButtonVisible);

        // Layer 4 & 5: Ekstraksi Konten Bersih & Konversi ke Markdown
        if (latestBotNode) {
          // Ekstrak bubble thought / deep think jika ada
          const thoughtEl = latestBotNode.querySelector('[class*="thought"], [class*="reasoning"], [class*="deep-think"], [data-testid*="thought"]');
          if (thoughtEl) {
            thoughtText = (thoughtEl.innerText || thoughtEl.textContent || '').trim();
          }

          // Ekstrak teks konten utama - klon seluruh latestBotNode dan hilangkan thought, toolbar, & action buttons
          const contentClone = latestBotNode.cloneNode(true);
          try {
            contentClone.querySelectorAll(
              '[class*="thought"], [class*="reasoning"], [class*="deep-think"], [data-testid*="thought"], button, svg, [role="button"], [class*="toolbar"], [class*="action"], [class*="feedback"], [class*="copy"], [class*="retry"], [class*="regenerate"], [class*="avatar"], [class*="timestamp"], [class*="time"], [class*="typing"], [class*="cursor-blink"], [class*="generating"], .animate-spin, [data-slot="message-actions"]'
            ).forEach((el) => el.remove());
          } catch (_) {}

          let rawText = convertNodeToMarkdown(contentClone);

          // Bersihkan thought jika masih tercampur di awal teks
          if (thoughtText && rawText.startsWith(thoughtText)) {
            rawText = rawText.slice(thoughtText.length).trim();
          }

          // Bersihkan kebocoran outbound system instruction jika terpantul
          if (rawText && (/^\[System Instruction:/i.test(rawText) || /^\[RIWAYAT LENGKAP PERCAKAPAN/i.test(rawText) || /^\[PANDUAN REFERENSI MEDIA\]/i.test(rawText))) {
            const userMarkerIdx = rawText.search(/\[Instruksi User(?: Saat Ini)?\]:\s*/i);
            if (userMarkerIdx >= 0) {
              const afterPrompt = rawText.slice(userMarkerIdx).replace(/^\[Instruksi User(?: Saat Ini)?\]:\s*[^\n]*\n*/i, '').trim();
              const parts = afterPrompt.split(/\n\s*\n/);
              rawText = parts.length > 1 ? parts.slice(1).join('\n\n').trim() : '';
            } else {
              rawText = '';
            }
          }

          if (rawText) {
            rawText = rawText.replace(/^\[Instruksi User(?: Saat Ini)?\]:\s*[^\n]*\n+/i, '').trim();
          }

          // Jangan ambil jika teks persis prompt user
          if (rawText && rawText !== userPrompt.trim()) {
            botText = rawText;
          }

          // 1. Ekstrak dari tombol unduh resmi / high-res origin URL Dola terlebih dahulu (pasti tanpa watermark)
          const downloadElements = Array.from(latestBotNode.querySelectorAll(
            'a[download], a[data-download-url], [data-download-url], [data-origin-url], [data-highres-url], a[href*="rc_gen_image"], a[href*="ibyteimg"]'
          ));
          for (const dlEl of downloadElements) {
            let dlUrl = dlEl.getAttribute('data-origin-url') ||
              dlEl.getAttribute('data-download-url') ||
              dlEl.getAttribute('data-highres-url') ||
              dlEl.getAttribute('href') ||
              '';
            if (dlUrl.startsWith('http')) {
              if (!dlUrl.includes('x-signature=') && dlUrl.includes('lr=cici_ai')) {
                dlUrl = dlUrl.replace(/&lr=cici_ai/g, '&lr=unwatermarked').replace(/\?lr=cici_ai/g, '?lr=unwatermarked');
              }
              const isClean = !dlUrl.includes('avatar') && !dlUrl.includes('logo') && !dlUrl.includes('watermark') && !imageUrls.includes(dlUrl);
              if (isClean) {
                imageUrls.push(dlUrl);
              }
            }
          }

          // 2. Ekstrak dari elemen img & background dalam container generasi (creation_block, image card, atau container media)
          const imageCandidates = Array.from(latestBotNode.querySelectorAll(
            '.creation_block img, [data-slot="creation"] img, div[class*="creation"] img, div[class*="image-card"] img, div[class*="img-wrap"] img, [data-origin-url], [data-highres-url], [data-image-url]'
          ));
          const allImgs = imageCandidates.length > 0 ? imageCandidates : Array.from(latestBotNode.querySelectorAll('img, [data-image-url]'));
          for (const imageEl of allImgs) {
            const elClass = (imageEl.className || '').toLowerCase();
            const elAria = (imageEl.getAttribute('aria-label') || '').toLowerCase();
            if (elClass.includes('watermark') || elClass.includes('logo') || elClass.includes('avatar') || elClass.includes('icon') || elAria.includes('watermark')) {
              continue;
            }

            // Abaikan icon UI kecil (kurang dari 80px)
            if (imageEl.tagName && imageEl.tagName.toLowerCase() === 'img') {
              const nw = imageEl.naturalWidth || imageEl.clientWidth || 0;
              const nh = imageEl.naturalHeight || imageEl.clientHeight || 0;
              if (nw > 0 && nw < 80 && nh > 0 && nh < 80) continue;
            }

            let candidate = imageEl.getAttribute('data-origin-url') ||
              imageEl.getAttribute('data-download-url') ||
              imageEl.getAttribute('data-highres-url') ||
              imageEl.getAttribute('data-image-url') ||
              imageEl.getAttribute('data-src') ||
              imageEl.currentSrc ||
              imageEl.getAttribute('src') ||
              '';

            if (!candidate && imageEl.style && imageEl.style.backgroundImage) {
              const bgMatch = imageEl.style.backgroundImage.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/i);
              if (bgMatch) candidate = bgMatch[1];
            }

            if (imageEl.srcset) {
              const srcsetParts = imageEl.srcset.split(',').map((s) => s.trim().split(' ')[0]);
              if (srcsetParts.length > 0 && srcsetParts[srcsetParts.length - 1].startsWith('http')) {
                candidate = srcsetParts[srcsetParts.length - 1];
              }
            }

            if (candidate && candidate.startsWith('http')) {
              if (!candidate.includes('x-signature=') && candidate.includes('lr=cici_ai')) {
                candidate = candidate.replace(/&lr=cici_ai/g, '&lr=unwatermarked').replace(/\?lr=cici_ai/g, '?lr=unwatermarked');
              }
              const isGeneratedImage =
                !candidate.includes('avatar') &&
                !candidate.includes('logo') &&
                !candidate.includes('watermark') &&
                !candidate.includes('app_icon') &&
                !candidate.includes('favicon') &&
                !candidate.includes('download-windows') &&
                !candidate.includes('/icon') &&
                !imageUrls.includes(candidate);
              if (isGeneratedImage) {
                imageUrls.push(candidate);
              }
            }
          }

          // 3. Ekstrak URL gambar langsung dari teks balasan jika ada
          const textUrlMatches = (rawText || '').match(/https?:\/\/[^\s"'<>\)]*(?:ibyteimg\.com|byteimg\.com|rc_gen_image|flow-image-sign|\.jpe?g|\.png|\.webp|\.gif|\-image\.image)[^\s"'<>\)]*/gi);
          if (textUrlMatches) {
            for (const tu of textUrlMatches) {
              let cleanTu = tu.replace(/[,\.\)\]]$/, '');
              if (!cleanTu.includes('x-signature=') && cleanTu.includes('lr=cici_ai')) {
                cleanTu = cleanTu.replace(/&lr=cici_ai/g, '&lr=unwatermarked').replace(/\?lr=cici_ai/g, '?lr=unwatermarked');
              }
              if (!imageUrls.includes(cleanTu) && !cleanTu.includes('avatar') && !cleanTu.includes('logo') && !cleanTu.includes('watermark')) {
                imageUrls.push(cleanTu);
              }
            }
          }

          const videoCandidates = Array.from(latestBotNode.querySelectorAll(
            'video[src], video source[src], video[data-origin-url], [data-video-url]'
          )).reverse();
          for (const videoEl of videoCandidates) {
            const candidate = videoEl.getAttribute('data-video-url') ||
              videoEl.getAttribute('data-origin-url') ||
              videoEl.currentSrc ||
              videoEl.getAttribute('src') ||
              videoEl.querySelector?.('source[src]')?.getAttribute('src') ||
              '';
            if (candidate.startsWith('http')) {
              videoUrl = candidate;
              break;
            }
          }
        }

        const hasMedia = imageUrls.length > 0 || videoUrl.length > 0;
        const hasCompletedContent = botText.length > 0 || hasMedia;
        const isDone = hasCompletedContent && !isGenerating;
        return { text: botText, imageUrls, videoUrl, thinking: thoughtText, isDone, isGenerating };
      },
      [prompt, initialMsgCount, Array.from(initialMsgIds)]
    );

    const pollRes = pollResult?.[0]?.result ?? pollResult;

    // Fallback: Jika tab scraping belum mendapatkan teks setelah 12 detik, cek via Downlink API HANYA jika ada ID percakapan valid
    let currentConvId = conversationId || null;
    if (!currentConvId) {
      try {
        const urlCheck = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const match = window.location.pathname.match(/\/chat\/(\d+)/) || window.location.href.match(/\/chat\/(\d+)/);
            return match ? match[1] : null;
          },
        });
        if (urlCheck?.[0]?.result) {
          currentConvId = urlCheck[0].result;
        }
      } catch (_) {}
    }

    if (!pollRes?.text && currentConvId && (Date.now() - startTime > 12000)) {
      try {
        const apiRes = await pollRecentChatConv({
          targetConvId: currentConvId,
          conversationId: currentConvId,
          minCreateTimeSec: Math.floor(sentTimestamp / 1000) - 2,
        });
        if (apiRes?.text) {
          pollRes.text = apiRes.text;
          if (apiRes.images?.length) pollRes.imageUrls = apiRes.images;
          if (apiRes.videos?.length) pollRes.videoUrl = apiRes.videos[0];
          pollRes.isDone = true;
          pollRes.isGenerating = false;
        }
      } catch (_) {}
    }

    const responseSignature = JSON.stringify({
      text: pollRes?.text || '',
      images: pollRes?.imageUrls || [],
      video: pollRes?.videoUrl || '',
      thinking: pollRes?.thinking || '',
    });
    if (responseSignature && responseSignature === lastResponseSignature && pollRes?.isDone) {
      stableResponseCount += 1;
    } else if (responseSignature) {
      stableResponseCount = 0;
      lastResponseSignature = responseSignature;
    }
    if (pollRes?.text || pollRes?.imageUrls?.length || pollRes?.videoUrl || pollRes?.thinking) {
      if (pollRes.thinking) lastThinking = pollRes.thinking;
      if (pollRes.text) lastText = pollRes.text;
      for (const imageUrl of (pollRes.imageUrls || [])) {
        if (!lastText.includes(`[weavy_repost:${imageUrl}]`)) {
          lastText = `${lastText}\n\n[weavy_repost:${imageUrl}]`.trim();
        }
      }
      if (pollRes.videoUrl && !lastText.includes(`[weavy_repost_video:${pollRes.videoUrl}]`)) {
        lastText = `${lastText}\n\n[weavy_repost_video:${pollRes.videoUrl}]`.trim();
      }

      let formattedOut = '';
      if (lastThinking && lastThinking.trim()) {
        formattedOut += `<thought>\n${lastThinking.trim()}\n</thought>\n\n`;
      }
      formattedOut += lastText;

      // Jika masih mengetik tapi sudah ada teks sebagian atau thinking
      if (pollRes.isGenerating && !lastText && lastThinking) {
        onChunk(`<thought>\n${lastThinking.trim()}\n</thought>\n\n[chat_typing_loader]`);
      } else if (formattedOut) {
        onChunk(formattedOut);
      }

      if (pollRes.isDone && stableResponseCount >= 2) {
        let finalConvId = currentConvId || conversationId || null;
        try {
          const urlCheck = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const match = window.location.pathname.match(/\/chat\/(\d+)/) || window.location.href.match(/\/chat\/(\d+)/);
              return match ? match[1] : null;
            },
          });
          if (urlCheck?.[0]?.result) finalConvId = urlCheck[0].result;
        } catch (_) {}
        return {
          text: formattedOut || lastText,
          convId: finalConvId,
        };
      }
    } else if (pollRes?.isGenerating) {
      // Masih sedang berpikir / loading, tampilkan animasi titik-titik bergerak
      onChunk('[chat_typing_loader]');
    }
  }

  if (lastText) {
    let finalOut = '';
    if (lastThinking && lastThinking.trim()) {
      finalOut += `<thought>\n${lastThinking.trim()}\n</thought>\n\n`;
    }
    finalOut += lastText;
    let finalConvId = currentConvId || conversationId || null;
    try {
      const urlCheck = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const match = window.location.pathname.match(/\/chat\/(\d+)/) || window.location.href.match(/\/chat\/(\d+)/);
          return match ? match[1] : null;
        },
      });
      if (urlCheck?.[0]?.result) finalConvId = urlCheck[0].result;
    } catch (_) {}
    return {
      text: finalOut,
      convId: finalConvId,
    };
  }
  throw new Error('Timeout saat menunggu respon chat dari Dola AI.');
}

export async function fallbackDomExecution({
  prompt,
  isPro = false,
  referenceAssets = [],
  conversationId = null,
  onProgress = () => {},
  onChunk = () => {},
}) {
  return await executeDolaChatViaTab({
    prompt,
    isPro,
    referenceAssets,
    conversationId,
    onProgress,
    onChunk,
  });
}

/**
 * generateSilent: Menjalankan streaming chat Dola AI 100% di background via Tab Context Bridge.
 * Bekerja tanpa gerakan kursor/DOM, membawa cookies asli (termasuk mode Guest),
 * dan melakukan streaming delta response secara realtime.
 */
export async function generateSilent({
  prompt,
  isPro = false,
  history = [],
  referenceAssets = [],
  conversationId = null,
  lastSectionId = null,
  lastMessageIndex = null,
  onProgress = () => {},
  onChunk = () => {},
}) {
  onProgress(20, 'Menghubungkan ke tab Dola AI (Silent Background Stream)...');

  // 1. Dapatkan atau buka tab Dola di background (silent)
  const { tab } = await getOrOpenDolaTab();
  if (!tab?.id) {
    throw new Error('Tab Dola AI tidak ditemukan di browser.');
  }

  // 2. Siapkan parameter context & URL
  const browserCtx = await getDolaBrowserContext();
  const url = new URL('https://www.dola.com/chat/completion');
  url.searchParams.set('aid', '495671');
  url.searchParams.set('real_aid', '495671');
  url.searchParams.set('device_platform', 'web');
  url.searchParams.set('doubao_device_platform', 'web');
  url.searchParams.set('doubao_pc_version', '3.38.0');
  url.searchParams.set('pc_version', '3.38.0');
  url.searchParams.set('pkg_type', 'release_version');
  url.searchParams.set('region', 'ID');
  url.searchParams.set('sys_region', 'ID');
  url.searchParams.set('language', 'en');
  url.searchParams.set('samantha_web', '1');
  url.searchParams.set('use-olympus-account', '1');
  url.searchParams.set('version_code', '20800');
  url.searchParams.set('web_platform', 'browser');
  url.searchParams.set('tz_name', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta');

  if (browserCtx.fp) url.searchParams.set('fp', browserCtx.fp);
  if (browserCtx.tea_uuid) url.searchParams.set('tea_uuid', browserCtx.tea_uuid);
  if (browserCtx.web_id) url.searchParams.set('web_id', browserCtx.web_id);
  if (browserCtx.deviceId) url.searchParams.set('device_id', browserCtx.deviceId);
  if (browserCtx.msToken) url.searchParams.set('msToken', browserCtx.msToken);

  const webTabId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  url.searchParams.set('web_tab_id', webTabId);

  // Sync model mode jika melanjutkan percakapan yang ada
  if (conversationId) {
    try {
      await modifyDolaConversationModel({ conversationId, isPro, browserCtx });
    } catch (_) {}
  }

  // 3. Upload referensi gambar jika disediakan
  const uploadedRefImages = [];
  if (referenceAssets && referenceAssets.length > 0) {
    for (let i = 0; i < Math.min(referenceAssets.length, 3); i++) {
      try {
        const up = await uploadDolaReferenceImage(referenceAssets[i]);
        if (up && up.uri) uploadedRefImages.push(up);
      } catch (err) {
        console.warn('[weavy-dola-chat] Gagal background upload ref ${i + 1}:', err);
      }
    }
  }

  const localConvId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? `local_${crypto.randomUUID()}`
    : `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const localMsgId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const blockId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const uniqueKey = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `uk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const contentBlocks = [];
  if (uploadedRefImages.length > 0) {
    uploadedRefImages.forEach((ref, idx) => {
      contentBlocks.push({
        block_type: 2000,
        content: {
          image_block: {
            image_uri: ref.uri,
            name: ref.name || `ref_${idx + 1}.jpg`,
            width: ref.width || 1024,
            height: ref.height || 1024,
          },
        },
      });
    });
  }

  contentBlocks.push({
    block_type: 10000,
    content: {
      text_block: {
        text: prompt,
        icon_url: '',
        icon_url_dark: '',
        summary: '',
      },
      pc_event_block: '',
    },
    block_id: blockId,
    parent_id: '',
    meta_info: [],
    append_fields: [],
  });

  const modelItemKey = isPro ? '4' : '0';
  const agentMode = isPro ? 1 : 2;
  const needDeepThink = isPro ? 4 : 0;

  const payload = {
    client_meta: {
      local_conversation_id: conversationId ? '' : localConvId,
      conversation_id: conversationId ? String(conversationId) : '',
      bot_id: '7339470689562525703',
      last_section_id: lastSectionId ? String(lastSectionId) : '',
      last_message_index: typeof lastMessageIndex === 'number' ? lastMessageIndex : (conversationId ? 10 : null),
      local_permissions: [
        { permission_name: 'ACCESS_COARSE_LOCATION', status: 3 },
        { permission_name: 'ACCESS_FINE_LOCATION', status: 3 },
        { permission_name: 'ACCESS_BACKGROUND_LOCATION', status: 3 },
      ],
    },
    messages: [
      {
        local_message_id: localMsgId,
        content_block: contentBlocks,
        message_status: 0,
      },
    ],
    option: {
      send_message_scene: '',
      create_time_ms: Date.now(),
      collect_id: '',
      is_audio: false,
      answer_with_suggest: false,
      agent_mode: agentMode,
      tts_switch: false,
      need_deep_think: needDeepThink,
      click_clear_context: false,
      from_suggest: false,
      is_regen: false,
      is_replace: false,
      is_from_click_option: false,
      is_from_click_softlink: false,
      disable_sse_cache: false,
      select_text_action: '',
      is_select_text: false,
      resend_for_regen: false,
      scene_type: 0,
      unique_key: uniqueKey,
      start_seq: 0,
      need_create_conversation: !conversationId,
      regen_query_id: [],
      edit_query_id: [],
      regen_instruction: '',
      no_replace_for_regen: false,
      message_from: 0,
      shared_app_name: '',
      shared_app_id: '',
      sse_recv_event_options: { support_chunk_delta: true },
      support_lazy_fetch_stream: true,
      is_ai_playground: false,
      is_old_user: false,
      general_task_param: {
        runtime_type: 0,
        agent_task_param: {},
        agent_task_param_change: {
          runtime_changed: false,
          device_changed: false,
          sandbox_auth_type_changed: false,
        },
        project_id: '',
        need_modify_conversation: false,
      },
      recovery_option: {
        is_recovery: false,
        req_create_time_sec: Math.floor(Date.now() / 1000),
        append_sse_event_scene: 0,
      },
      message_storage_type: 0,
      related_deleted_message_ids: {},
      connector_info_list: [],
      model_config: {
        model_item_key: modelItemKey,
        model_extra_params: {},
      },
      aggregate_params: {
        mention_skill_list: '[]',
        mention_plugin_list: '[]',
        mention_ext: '[{}]',
        conversation_mode: '',
        mode_id: '',
        model_item_key: modelItemKey,
        agent_mode: String(agentMode),
        reasoning_effort: '',
        provider_id: '',
      },
    },
    user_context: [],
    ext: {
      agent_mode: String(agentMode),
      use_deep_think: String(needDeepThink),
      general_task_param: JSON.stringify({
        runtime_type: 0,
        agent_task_param: {},
        agent_task_param_change: {
          runtime_changed: false,
          device_changed: false,
          sandbox_auth_type_changed: false,
        },
        project_id: '',
        need_modify_conversation: false,
      }),
      collection_id: '',
      is_finish: '1',
      commerce_credit_config_enable: '0',
    },
    chat_ability: null,
  };

  const streamId = `dola_stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  onProgress(35, `Mengalirkan balasan Dola AI (${isPro ? '💎 Pro' : '⚡ Fast'}) di background...`);

  return new Promise((resolve, reject) => {
    let accumulatedText = '';
    let accumulatedThinking = '';
    const mediaSet = new Set();
    let isChunkDeltaMode = false;
    let serverConvId = conversationId || null;
    let serverSectionId = lastSectionId || null;
    let serverMsgIndex = lastMessageIndex || null;
    let streamBuffer = '';
    let isResolved = false;

    const dispatchUpdate = () => {
      let fullDisplay = '';
      if (accumulatedThinking && accumulatedThinking.trim()) {
        fullDisplay += `> 💭 *Berpikir:* \n> ${accumulatedThinking.trim().replace(/\n/g, '\n> ')}\n\n`;
      }
      let contentBody = accumulatedText;
      for (const mTag of mediaSet) {
        if (!contentBody.includes(mTag)) {
          contentBody = `${contentBody}\n\n${mTag}`.trim();
        }
      }
      fullDisplay += contentBody;
      if (fullDisplay) {
        onChunk(fullDisplay);
      }
    };

    const processRawLine = (rawLine) => {
      let line = rawLine.trim();
      if (!line) return;

      if (
        line.includes('STREAM_ERROR') ||
        line.includes('710022004') ||
        line.includes('shark_admin') ||
        line.includes('"subtype":"slide"')
      ) {
        throw new Error('DOLA_WAF_CHALLENGE');
      }

      const convMatch = line.match(/"conversation_id"\s*:\s*"(\d+)"/) || line.match(/"conv_id"\s*:\s*"(\d+)"/);
      if (convMatch && convMatch[1]) serverConvId = convMatch[1];
      const secMatch = line.match(/"last_section_id"\s*:\s*"(\d+)"/) || line.match(/"section_id"\s*:\s*"(\d+)"/);
      if (secMatch && secMatch[1]) serverSectionId = secMatch[1];
      const idxMatch = line.match(/"last_message_index"\s*:\s*(\d+)/);
      if (idxMatch && idxMatch[1]) serverMsgIndex = parseInt(idxMatch[1], 10);

      // Extract JSON payload from SSE format
      if (line.startsWith('data:')) {
        line = line.slice(5).trim();
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith(':')) {
        return;
      }

      if (!line || line === '[DONE]') return;

      try {
        const data = JSON.parse(line);

        // 1. Dola Chunk Delta directly (support_chunk_delta: true)
        if (typeof data.chunk_delta === 'string' && data.chunk_delta) {
          isChunkDeltaMode = true;
          accumulatedText += data.chunk_delta;
          dispatchUpdate();
          return;
        }

        // 2. Pro Deep Think / Reasoning Delta
        if (typeof data.deep_think_delta === 'string' && data.deep_think_delta) {
          accumulatedThinking += data.deep_think_delta;
          dispatchUpdate();
          return;
        }
        if (typeof data.reasoning_content === 'string' && data.reasoning_content) {
          accumulatedThinking += data.reasoning_content;
          dispatchUpdate();
          return;
        }

        // 3. Messages array
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const latestBotMsg = data.messages.slice().reverse().find((m) => m.user_type === 2 || m.role === 'assistant');
          if (latestBotMsg) {
            if (latestBotMsg.content) {
              const parsed = extractDolaMessagePayload(latestBotMsg.content);
              for (const img of parsed.images) mediaSet.add(`[weavy_repost:${img}]`);
              for (const vid of parsed.videos) mediaSet.add(`[weavy_repost_video:${vid}]`);
              if (!isChunkDeltaMode && parsed.text && parsed.text.length > accumulatedText.length) {
                accumulatedText = parsed.text;
              }
            }
            if (Array.isArray(latestBotMsg.content_block)) {
              const parsed = extractDolaMessagePayload(latestBotMsg.content_block);
              for (const img of parsed.images) mediaSet.add(`[weavy_repost:${img}]`);
              for (const vid of parsed.videos) mediaSet.add(`[weavy_repost_video:${vid}]`);
              if (!isChunkDeltaMode && parsed.text && parsed.text.length > accumulatedText.length) {
                accumulatedText = parsed.text;
              }
            }
            dispatchUpdate();
            return;
          }
        }

        // 4. Downlink Body Delta
        if (!isChunkDeltaMode && data.downlink_body?.delta) {
          const dlText = typeof data.downlink_body.delta === 'string'
            ? data.downlink_body.delta
            : (data.downlink_body.delta.content || '');
          if (dlText) {
            accumulatedText += dlText;
            dispatchUpdate();
          }
        }
      } catch (e) {
        if (e.message === 'DOLA_WAF_CHALLENGE') throw e;
      }
    };

    const cleanup = () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      clearTimeout(timeoutId);
    };

    const finalize = () => {
      if (isResolved) return;
      isResolved = true;
      cleanup();

      let finalBody = accumulatedText.trim();
      for (const mTag of mediaSet) {
        if (!finalBody.includes(mTag)) {
          finalBody = `${finalBody}\n\n${mTag}`.trim();
        }
      }

      if (finalBody) {
        const finalResult = (accumulatedThinking && accumulatedThinking.trim()
          ? `> 💭 *Berpikir:* \n> ${accumulatedThinking.trim().replace(/\n/g, '\n> ')}\n\n`
          : '') + finalBody;

        const resObj = new String(finalResult);
        resObj.text = finalResult;
        resObj.convId = serverConvId;
        resObj.sectionId = serverSectionId;
        resObj.msgIndex = serverMsgIndex;
        resolve(resObj);
      } else {
        reject(new Error('Respon Dola AI kosong dari silent stream.'));
      }
    };

    const messageListener = (msg) => {
      if (!msg || msg.streamId !== streamId) return;

      if (msg.action === 'STREAM_CHUNK' && typeof msg.chunk === 'string') {
        streamBuffer += msg.chunk;
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';
        for (const line of lines) {
          try {
            processRawLine(line);
          } catch (lineErr) {
            cleanup();
            reject(lineErr);
            return;
          }
        }
      } else if (msg.action === 'STREAM_DONE') {
        if (streamBuffer.trim()) {
          try {
            processRawLine(streamBuffer.trim());
          } catch (_) {}
        }
        finalize();
      } else if (msg.action === 'STREAM_ERROR') {
        cleanup();
        reject(new Error(msg.error || 'Dola stream error'));
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Timeout streaming
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        if (accumulatedText.trim()) {
          finalize();
        } else {
          cleanup();
          reject(new Error('Timeout streaming Dola AI'));
        }
      }
    }, 75000);

    // Jalankan streaming fetch langsung di dalam konteks tab Dola (kebal terhadap "Receiving end does not exist")
    executeTabContextStreamFetch(tab.id, streamId, url.toString(), payload).catch((err) => {
      cleanup();
      reject(new Error(`Gagal menginjeksi streaming ke tab Dola: ${err.message}`));
    });
  });
}

export async function executeDolaChat({
  prompt,
  isPro = false,
  history = [],
  referenceAssets = [],
  conversationId = null,
  lastSectionId = null,
  lastMessageIndex = null,
  onProgress = () => {},
  onChunk = () => {},
}) {
  // Silent Background Stream dinonaktifkan (ENABLE_SILENT_STREAM = false)
  // karena proteksi anti-bot WAF Shark Dola memblokir raw background stream.
  // 100% menggunakan DOM Automation yang terbukti stabil & tidak memicu challenge.
  const ENABLE_SILENT_STREAM = false;

  if (ENABLE_SILENT_STREAM) {
    try {
      return await generateSilent({
        prompt,
        isPro,
        history,
        referenceAssets,
        conversationId,
        lastSectionId,
        lastMessageIndex,
        onProgress,
        onChunk,
      });
    } catch (silentError) {
      console.warn('[weavy-dola-chat] ⚠️ Silent stream gagal/dibatasi, beralih ke DOM Automation:', silentError);
    }
  }

  // 100% DOM Automation via Tab Dola AI
  return await executeDolaChatViaTab({
    prompt,
    isPro,
    referenceAssets,
    conversationId,
    onProgress,
    onChunk,
  });
}

/**
 * Membuka / mengklik percakapan baru (New Chat) di tab Dola AI
 * Mengikuti pola yang sama persis seperti di Menu Generate (executeDolaImageGeneration).
 */
export async function createDolaNewChatSessionInTab({ openIfMissing = false } = {}) {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
    return { success: false, reason: 'Chrome tabs / scripting API tidak tersedia.' };
  }

  try {
    const existingTabs = await chrome.tabs.query({ url: ['*://*.dola.com/*', '*://dola.com/*'] });
    let targetTab = (existingTabs || []).find((tab) => tab.url?.includes('/chat')) || existingTabs?.[0];

    if (!targetTab) {
      if (!openIfMissing) {
        return { success: false, reason: 'Tab Dola AI tidak ditemukan di browser.' };
      }
      const { tab } = await getOrOpenDolaTab();
      targetTab = tab;
    }

    if (!targetTab?.id) {
      return { success: false, reason: 'ID Tab Dola tidak ditemukan.' };
    }

    const [execResult] = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: async () => {
        const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        const triggerFullClick = (el) => {
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const evtOpts = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            button: 0,
          };

          // 1. Pointer events
          try {
            el.dispatchEvent(new PointerEvent('pointerdown', { ...evtOpts, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1 }));
          } catch (_) {}

          // 2. Mouse events
          el.dispatchEvent(new MouseEvent('mousedown', { ...evtOpts, buttons: 1 }));
          try {
            el.dispatchEvent(new PointerEvent('pointerup', { ...evtOpts, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0 }));
          } catch (_) {}
          el.dispatchEvent(new MouseEvent('mouseup', { ...evtOpts, buttons: 0 }));
          el.dispatchEvent(new MouseEvent('click', { ...evtOpts, buttons: 0 }));

          // 3. Native .click()
          try {
            el.click();
          } catch (_) {}
        };

        // Buka Percakapan Baru (New Chat) seperti di Menu Generate
        try {
          const findNewChatBtn = () => {
            const direct = document.querySelector('[data-testid="new-chat-button"]') ||
              document.querySelector('button[data-testid="new-chat-btn"]');
            if (direct) return direct;

            const buttons = Array.from(document.querySelectorAll('button, div[role="button"], a[href*="/chat"], [role="link"]'));
            return buttons.find((btn) => {
              const aria = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase();
              if (aria.includes('new chat') || aria.includes('create chat') || aria.includes('compose') || aria.includes('chat baru')) return true;
              const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
              if (text === 'new chat' || text === 'chat baru' || text === '+ new chat' || text === 'percakapan baru') return true;
              const paths = Array.from(btn.querySelectorAll('svg path'));
              return paths.some((p) => {
                const d = p.getAttribute('d') || '';
                return d.includes('1.99882') || d.includes('17.0459') || d.includes('11.5867') || d.includes('13.4549');
              });
            });
          };

          const newChatBtn = findNewChatBtn();
          if (newChatBtn) {
            triggerFullClick(newChatBtn);
            await waitMs(600);
          } else if (window.location.pathname && window.location.pathname.length > 6) {
            window.location.href = 'https://www.dola.com/chat';
            await waitMs(600);
          }

          // Bersihkan juga editor input agar tidak meninggalkan draft lama
          try {
            const editorEl = document.querySelector('div.tiptap.ProseMirror, #input-engine-container [contenteditable="true"], textarea');
            if (editorEl) {
              if (editorEl.isContentEditable) editorEl.innerHTML = '';
              else editorEl.value = '';
              editorEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } catch (_) {}

          return { success: true, method: newChatBtn ? 'new_chat_button' : 'navigate_or_clean' };
        } catch (innerErr) {
          console.warn('[weavy-dola-tab] Trigger new chat error:', innerErr);
          return { success: false, error: innerErr.message };
        }
      },
    });

    console.log('[weavy-dola] Sesi baru Dola berhasil dibuat di tab background:', execResult?.result);
    return { success: true, result: execResult?.result };
  } catch (err) {
    console.warn('[weavy-dola] Gagal membuat sesi baru di tab Dola:', err);
    return { success: false, error: err.message };
  }
}

