/**
 * Helper polling status video Google Gemini (Omni Flash / Veo via sesi web).
 * Dipakai oleh menu Chat untuk jalur yang menerima `operationName` (instant hand-off)
 * dari `/api/gemini/generate-video`, lalu menunggu `/api/gemini/video-status` selesai.
 */

export interface PollGeminiVideoParams {
  operationName: string;
  cookies?: string;
  apiKey?: string;
  email?: string;
  fallbackAccounts?: any[];
  maxAttempts?: number;
  intervalMs?: number;
}

export interface PollGeminiVideoResult {
  videoUrl: string;
  remainingCredits?: number;
}

export async function pollGeminiVideoStatus(
  params: PollGeminiVideoParams,
): Promise<PollGeminiVideoResult> {
  const {
    operationName,
    cookies,
    apiKey,
    email,
    fallbackAccounts = [],
    maxAttempts = 80,
    intervalMs = 3000,
  } = params;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const resp = await fetch("/api/gemini/video-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationName,
          cookies,
          token: cookies,
          apiKey,
          email,
          fallbackAccounts,
        }),
      });
      if (!resp.ok) continue;
      const st = await resp.json().catch(() => ({}));

      if (st.success && st.status === "completed" && st.videoUrl) {
        return { videoUrl: st.videoUrl, remainingCredits: st.remainingCredits };
      }

      const failed =
        st.status === "failed" ||
        (st.error && st.done) ||
        (st.done && !st.videoUrl) ||
        (st.status === "completed" && !st.videoUrl);
      if (failed) {
        const err: any = new Error(
          st.error || st.errorMessage || st.text || "Gemini Omni Flash merespons bukan hasil video generate.",
        );
        err.isFatalGenerationFailure = true;
        err.isQuotaExhausted = Boolean(st.isQuotaExhausted);
        err.remainingCredits = st.remainingCredits;
        throw err;
      }
    } catch (e: any) {
      if (e?.isFatalGenerationFailure) throw e;
      // Gangguan jaringan sesaat: lanjutkan polling.
    }
  }
  throw new Error("Waktu tunggu render video Gemini Omni Flash habis (timeout) atau video belum siap.");
}
