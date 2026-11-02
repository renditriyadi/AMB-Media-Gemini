export type VideoProviderId = "gemini" | "runninghub" | "weavy";

export interface VideoProviderInfo {
  id: VideoProviderId;
  /** Short name, e.g. "Gemini Omni Flash" */
  name: string;
  /** Label shown on the progress card, e.g. "Gemini Omni Flash" */
  progressLabel: string;
}

const INFO: Record<VideoProviderId, VideoProviderInfo> = {
  gemini: { id: "gemini", name: "Gemini Omni Flash", progressLabel: "Gemini Omni Flash" },
  runninghub: { id: "runninghub", name: "RunningHub", progressLabel: "RunningHub AI Video" },
  weavy: { id: "weavy", name: "Weavy AI", progressLabel: "Weavy AI Video" },
};

/**
 * Resolve which provider produced (or is producing) a video.
 * Prefers the explicit `provider` stored on the message, then falls back to
 * guessing from the model name (for messages saved before `provider` existed).
 */
export function resolveVideoProvider(provider?: string, modelName?: string): VideoProviderInfo {
  const p = (provider || "").toLowerCase();
  if (p.includes("gemini") || p.includes("google") || p.includes("veo")) return INFO.gemini;
  if (p.includes("runninghub")) return INFO.runninghub;
  if (p.includes("weavy")) return INFO.weavy;

  const m = (modelName || "").toLowerCase();
  if (m.includes("gemini") || m.includes("veo") || m.includes("omni")) return INFO.gemini;
  if (m.includes("seedance") || m.includes("kling") || m.includes("weavy")) return INFO.weavy;
  return INFO.runninghub;
}
