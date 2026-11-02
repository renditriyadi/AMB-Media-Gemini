import {
  applyGeminiAccountSwitch,
  autoSyncGeminiAccountCredits,
  buildGeminiPayloadAccounts,
  handleGeminiExhaustedAccounts,
} from './geminiAccountManager';
import { safeFetchJson } from '../utils';

interface GeminiVideoAccountPayload {
  id?: string;
  accountId?: string;
  email?: string;
  name?: string;
  token?: string;
  apiKey?: string;
  cookies?: string;
  fallbackAccounts?: Array<Record<string, unknown>>;
}

interface GeminiVideoRunnerParams {
  prompt: string;
  aspectRatio: string;
  duration: string;
  resolution: string;
  model: string;
  referenceImageUrls: string[];
  referenceVideoUrls: string[];
  attachedMedia: Array<{ type: string; url: string }>;
  accountPayload: GeminiVideoAccountPayload;
  initialResponseData?: Record<string, any>;
  onProgress?: (progress: number, message: string) => void;
  onTaskAccepted?: (operationName: string) => void;
  onAccountSwitch?: (account: Record<string, any>, reason: string) => void;
  onRetry?: (attempt: number, maxAttempts: number, reason: string, accountName: string) => void;
}

interface GeminiVideoRunnerResult {
  videoUrl: string;
  operationName?: string;
  remainingCredits?: number;
}

const POLL_INTERVAL_MS = 4000;
const MAX_GEMINI_VIDEO_WAIT_MS = 9 * 60 * 1000;
const MAX_POLL_ATTEMPTS = Math.ceil(MAX_GEMINI_VIDEO_WAIT_MS / POLL_INTERVAL_MS);

function getResponseError(data: any, fallback: string): string {
  return data?.errorMessage || data?.error || data?.text || fallback;
}

function accountName(account: GeminiVideoAccountPayload): string {
  return account.name || account.email || 'akun Gemini aktif';
}

function getWebSessionToken(value?: string): string | undefined {
  if (!value || value.trim().startsWith('AIza')) return undefined;
  return value;
}

function getAccountPayload(account: { id: string; [key: string]: any }): GeminiVideoAccountPayload {
  return buildGeminiPayloadAccounts(account);
}

function accountKey(account: Record<string, any>): string {
  return String(account.id || account.email || '').toLowerCase();
}

export async function executeGeminiVideoWithAutoSwitchAndRetry({
  prompt,
  aspectRatio,
  duration,
  resolution,
  model,
  referenceImageUrls,
  referenceVideoUrls,
  attachedMedia,
  accountPayload,
  initialResponseData,
  onProgress,
  onTaskAccepted,
  onAccountSwitch,
}: GeminiVideoRunnerParams): Promise<GeminiVideoRunnerResult> {
  onProgress?.(15, 'Mengirim permintaan video ke Google Gemini...');

  const fallbackAccounts = (accountPayload.fallbackAccounts || []).map((account) => ({
    id: account.id,
    email: account.email,
    name: account.name,
    token: getWebSessionToken(typeof account.token === 'string' ? account.token : undefined),
    cookies: getWebSessionToken(typeof account.cookies === 'string' ? account.cookies : undefined),
  }));
  let generateData = initialResponseData;
  if (!generateData) {
    const response = await safeFetchJson(
      '/api/gemini/generate-video',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          duration,
          resolution,
          model,
          id: accountPayload.id,
          accountId: accountPayload.accountId,
          email: accountPayload.email,
          name: accountPayload.name,
          token: getWebSessionToken(accountPayload.token),
          cookies: getWebSessionToken(accountPayload.cookies) || getWebSessionToken(accountPayload.token),
          fallbackAccounts,
          referenceImageUrl: referenceImageUrls[0],
          referenceImageUrls,
          referenceVideoUrl: referenceVideoUrls[0],
          referenceVideoUrls,
          attachedMedia,
        }),
      },
      0,
    );
    generateData = response.data;

    if (!response.ok || !generateData?.success) {
      const message = getResponseError(generateData, 'Gagal mengirim permintaan video Gemini.');
      handleGeminiExhaustedAccounts(generateData, message, accountPayload);
      if (typeof generateData?.remainingCredits === 'number') {
        autoSyncGeminiAccountCredits(accountPayload, generateData.remainingCredits);
      } else if (generateData?.isQuotaExhausted) {
        autoSyncGeminiAccountCredits(accountPayload, 0);
      }
      throw new Error(message);
    }
  }

  let activeAccount = accountPayload;
  const attemptedAccounts = new Set<string>();
  if (accountPayload.id) attemptedAccounts.add(accountKey(accountPayload));
  for (const exhausted of generateData.exhaustedAccounts || []) {
    const key = accountKey(exhausted);
    if (key) attemptedAccounts.add(key);
  }
  if (generateData.usedAccount) {
    activeAccount = getAccountPayload(generateData.usedAccount);
    const usedAccountKey = accountKey(generateData.usedAccount);
    if (usedAccountKey) attemptedAccounts.add(usedAccountKey);
    const didSwitch =
      generateData.wasSwitched ||
      (generateData.usedAccount.id &&
        accountPayload.id &&
        generateData.usedAccount.id !== accountPayload.id);
    if (didSwitch) {
      const reason = generateData.message || 'Gemini otomatis beralih ke akun lain.';
      applyGeminiAccountSwitch(generateData.usedAccount);
      onAccountSwitch?.(generateData.usedAccount, reason);
    }
  }

  if (typeof generateData.remainingCredits === 'number') {
    autoSyncGeminiAccountCredits(generateData.usedAccount || activeAccount, generateData.remainingCredits);
  }

  let operationName = generateData.operationName || generateData.taskId;
  if (operationName) onTaskAccepted?.(operationName);
  let operationStartedAt = Date.now();
  let operationDeadline = operationStartedAt + MAX_GEMINI_VIDEO_WAIT_MS;
  if (generateData.videoUrl) {
    onProgress?.(100, 'Video Gemini selesai dibuat.');
    return {
      videoUrl: generateData.videoUrl,
      operationName,
      remainingCredits: generateData.remainingCredits,
    };
  }

  if (!operationName) {
    throw new Error('Gemini tidak mengembalikan URL video atau ID operasi untuk dipantau.');
  }

  const hasWebSession = (account: Record<string, any>) => {
    const cookieValue = String(account.cookies || account.token || account.refreshToken || '');
    return /(?:__Secure-1PSID|(?:^|;\s*)SID=|(?:^|;\s*)SAPISID=)/i.test(cookieValue);
  };

  for (
    let attempt = 0;
    attempt < MAX_POLL_ATTEMPTS && Date.now() < operationDeadline;
    attempt++
  ) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const { ok: pollOk, status: pollStatus, data: pollData } = await safeFetchJson(
      '/api/gemini/video-status',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationName,
          startedAt: operationStartedAt,
          token: activeAccount.token || activeAccount.cookies,
          cookies: activeAccount.cookies,
          email: activeAccount.email,
        }),
      },
    );

    if (
      !pollOk &&
      pollStatus === 500 &&
      pollData?.error === 'Respon server bukan JSON valid (HTML/Timeout). Silakan coba lagi.'
    ) {
      throw new Error('Status Gemini tidak memberikan respons JSON yang valid. Polling task dihentikan.');
    }

    if (pollData?.failureSource === 'status_poll') {
      const message = getResponseError(
        pollData,
        'Pengecekan status Gemini gagal. Task dihentikan.',
      );
      handleGeminiExhaustedAccounts(pollData, message, activeAccount);
      if (typeof pollData?.remainingCredits === 'number') {
        autoSyncGeminiAccountCredits(activeAccount, pollData.remainingCredits);
      }
      throw new Error(message);
    }

    if (pollData?.failureSource === 'generation_not_confirmed') {
      const message = getResponseError(
        pollData,
        'Gemini tidak mengonfirmasi bahwa generasi video dimulai. Task dihentikan.',
      );
      handleGeminiExhaustedAccounts(pollData, message, activeAccount);
      if (typeof pollData?.remainingCredits === 'number') {
        autoSyncGeminiAccountCredits(activeAccount, pollData.remainingCredits);
      }
      throw new Error(message);
    }

    const remainingCredits =
      typeof pollData?.remainingCredits === 'number'
        ? pollData.remainingCredits
        : pollData?.userRemainingCredits;
    if (typeof remainingCredits === 'number') {
      autoSyncGeminiAccountCredits(activeAccount, remainingCredits);
    }

    onProgress?.(
      Math.min(95, 20 + Math.floor(((attempt + 1) / MAX_POLL_ATTEMPTS) * 75)),
      `Gemini sedang merender video... (${attempt + 1}/${MAX_POLL_ATTEMPTS})`,
    );

    const videoUrl = pollData?.videoUrl || pollData?.mediaUrl || pollData?.resultUrl;
    if (
      pollData?.success &&
      (pollData?.status === 'completed' ||
        pollData?.status === 'SUCCESS' ||
        pollData?.rawStatus === 'SUCCESS' ||
        pollData?.done) &&
      videoUrl
    ) {
      onProgress?.(100, 'Video Gemini selesai dibuat.');
      return { videoUrl, operationName, remainingCredits };
    }

    const errorText = String(pollData?.error || pollData?.errorMessage || pollData?.text || '').toLowerCase();
    const isFailureMessage = [
      'traffic pembuatan video',
      'kapasitas saya penuh',
      'kapasitas penuh',
      'kapasitas sedang penuh',
      'luar biasa tinggi',
      'coba lagi nanti',
      'capacity is full',
      'try again later',
    ].some((phrase) => errorText.includes(phrase));
    const isFailed =
      pollData?.status === 'failed' ||
      pollData?.status === 'FAILED' ||
      (pollData?.success === false && (pollData?.error || pollData?.errorMessage)) ||
      (pollData?.done && !videoUrl) ||
      ((pollData?.status === 'completed' ||
        pollData?.status === 'SUCCESS' ||
        pollData?.rawStatus === 'SUCCESS') &&
        !videoUrl) ||
      isFailureMessage;
    if (isFailed) {
      const message = getResponseError(pollData, 'Gemini gagal menyelesaikan generasi video.');
      handleGeminiExhaustedAccounts(pollData, message, activeAccount);
      if (pollData?.isQuotaExhausted) {
        autoSyncGeminiAccountCredits(activeAccount, 0);
      }

      const nextAccounts = (accountPayload.fallbackAccounts || [])
        .filter((account) => {
          const key = accountKey(account);
          const hasValidWebSession = hasWebSession(account);
          const credits = typeof account.credits === 'number' ? account.credits : 3;
          return key && !attemptedAccounts.has(key) && hasValidWebSession && credits > 0;
        })
        .sort((a, b) => {
          const creditsA = typeof a.credits === 'number' ? a.credits : 3;
          const creditsB = typeof b.credits === 'number' ? b.credits : 3;
          return creditsB - creditsA;
        });

      let retryData: any = null;
      let retryError = message;
      while (nextAccounts.length > 0 && !retryData) {
        const candidate = nextAccounts.shift()!;
        const candidateKey = accountKey(candidate);
        attemptedAccounts.add(candidateKey);
        const retryAccount = getAccountPayload(candidate as { id: string; [key: string]: any });
        onProgress?.(
          Math.min(95, 20 + Math.floor(((attempt + 1) / MAX_POLL_ATTEMPTS) * 75)),
          `Akun Gemini "${accountName(activeAccount)}" gagal: ${message}. Beralih ke "${accountName(retryAccount)}"...`,
        );

        try {
          const { ok: retryOk, data: responseData } = await safeFetchJson(
            '/api/gemini/generate-video',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt,
                aspectRatio,
                duration,
                resolution,
                model,
                id: retryAccount.id,
                accountId: retryAccount.accountId,
                email: retryAccount.email,
                name: retryAccount.name,
                token: getWebSessionToken(retryAccount.token),
                cookies: getWebSessionToken(retryAccount.cookies) || getWebSessionToken(retryAccount.token),
                fallbackAccounts: [],
                referenceImageUrl: referenceImageUrls[0],
                referenceImageUrls,
                referenceVideoUrl: referenceVideoUrls[0],
                referenceVideoUrls,
                attachedMedia,
              }),
            },
            0,
          );
          if (!retryOk || !responseData?.success) {
            retryError = getResponseError(responseData, `Gagal menggunakan akun Gemini "${accountName(retryAccount)}".`);
            handleGeminiExhaustedAccounts(responseData, retryError, retryAccount);
            if (typeof responseData?.remainingCredits === 'number') {
              autoSyncGeminiAccountCredits(retryAccount, responseData.remainingCredits);
            } else if (responseData?.isQuotaExhausted) {
              autoSyncGeminiAccountCredits(retryAccount, 0);
            }
            for (const exhausted of responseData?.exhaustedAccounts || []) {
              const key = accountKey(exhausted);
              if (key) attemptedAccounts.add(key);
            }
            continue;
          }

          retryData = responseData;
          const usedAccount = responseData.usedAccount || candidate;
          const usedKey = accountKey(usedAccount);
          if (usedKey) attemptedAccounts.add(usedKey);
          activeAccount = getAccountPayload(usedAccount);
          applyGeminiAccountSwitch(usedAccount);
          onAccountSwitch?.(
            usedAccount,
            `Akun sebelumnya gagal saat render. Gemini otomatis beralih ke "${accountName(activeAccount)}".`,
          );

          if (typeof responseData.remainingCredits === 'number') {
            autoSyncGeminiAccountCredits(usedAccount, responseData.remainingCredits);
          }

          const retryVideoUrl = responseData.videoUrl || responseData.mediaUrl || responseData.resultUrl;
          if (retryVideoUrl) {
            const retryOperationName = responseData.operationName || responseData.taskId;
            if (retryOperationName) onTaskAccepted?.(retryOperationName);
            onProgress?.(100, 'Video Gemini selesai dibuat.');
            return {
              videoUrl: retryVideoUrl,
              operationName: retryOperationName,
              remainingCredits: responseData.remainingCredits,
            };
          }

          const retryOperationName = responseData.operationName || responseData.taskId;
          if (!retryOperationName) {
            retryData = null;
            retryError = 'Akun Gemini berikutnya tidak mengembalikan ID operasi untuk dipantau.';
            continue;
          }

          operationName = retryOperationName;
          onTaskAccepted?.(operationName);
          operationStartedAt = Date.now();
          operationDeadline = operationStartedAt + MAX_GEMINI_VIDEO_WAIT_MS;
          onProgress?.(25, `Render dilanjutkan dengan akun Gemini "${accountName(activeAccount)}"...`);
        } catch (retryRequestError) {
          if (retryData) throw retryRequestError;
          retryError = retryRequestError instanceof Error ? retryRequestError.message : String(retryRequestError);
          throw new Error(`Gagal mencoba akun Gemini cadangan "${accountName(retryAccount)}": ${retryError}`);
        }
      }

      if (!retryData) {
        throw new Error(
          nextAccounts.length === 0
            ? `${message} Tidak ada akun Gemini lain dengan sesi valid dan kuota tersedia.`
            : retryError,
        );
      }
      continue;
    }
  }

  throw new Error('Gemini belum mengembalikan hasil final setelah 9 menit. Periksa riwayat Gemini sebelum menjalankan ulang agar tidak membuat task ganda.');
}
