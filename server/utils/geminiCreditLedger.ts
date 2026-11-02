import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const GEMINI_VIDEO_CREDIT_LIMIT = 2;
export const GEMINI_USAGE_FILE = path.join(process.cwd(), 'data', 'gemini_daily_usage.json');

export interface GeminiCreditUsageRecord {
  date?: string;
  used?: number;
  externalUsed?: number;
  completedTaskIds?: string[];
  chargedTaskIds?: string[];
  refundedTaskIds?: string[];
  failedGenerateTaskIds?: string[];
  [key: string]: unknown;
}

export interface GeminiCreditSnapshot {
  found: boolean;
  used: number;
  remaining: number;
  total: number;
}

export function normalizeGeminiUsed(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(GEMINI_VIDEO_CREDIT_LIMIT, Math.max(0, Math.floor(value)))
    : 0;
}

export function getGeminiLocalTaskUsage(record: GeminiCreditUsageRecord): number {
  const refundedTaskIds = new Set(
    Array.isArray(record.refundedTaskIds)
      ? record.refundedTaskIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []
  );
  const taskIds = new Set([
    ...(Array.isArray(record.completedTaskIds) ? record.completedTaskIds : []),
    ...(Array.isArray(record.chargedTaskIds) ? record.chargedTaskIds : []),
  ].filter((id): id is string => typeof id === 'string' && id.length > 0));
  return normalizeGeminiUsed([...taskIds].filter((id) => !refundedTaskIds.has(id)).length);
}

export function getGeminiGenerateFailureTaskIds(record: GeminiCreditUsageRecord): string[] {
  return Array.isArray(record.failedGenerateTaskIds)
    ? [...new Set(record.failedGenerateTaskIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
}

export function hasGeminiGenerateFailureHistory(record: GeminiCreditUsageRecord): boolean {
  return getGeminiGenerateFailureTaskIds(record).length > 0;
}

export function addGeminiGenerateFailureTaskId(record: GeminiCreditUsageRecord, taskId: string): GeminiCreditUsageRecord {
  const failedGenerateTaskIds = getGeminiGenerateFailureTaskIds(record);
  if (taskId && !failedGenerateTaskIds.includes(taskId)) failedGenerateTaskIds.push(taskId);
  return { ...record, failedGenerateTaskIds };
}

export function clearGeminiGenerateFailureHistory(record: GeminiCreditUsageRecord): GeminiCreditUsageRecord {
  return { ...record, failedGenerateTaskIds: [] };
}

export function prioritizeGeminiAccountsByFailureHistory<T>(
  accounts: T[],
  records: Record<string, GeminiCreditUsageRecord>,
  getKeys: (account: T) => string[]
): T[] {
  return accounts
    .map((account, index) => ({
      account,
      index,
      hasFailureHistory: [...new Set(getKeys(account))].some((key) =>
        hasGeminiGenerateFailureHistory(records[key] || {})
      ),
    }))
    .sort((left, right) => Number(left.hasFailureHistory) - Number(right.hasFailureHistory) || left.index - right.index)
    .map(({ account }) => account);
}

export function normalizeGeminiUsageRecord(record: GeminiCreditUsageRecord): GeminiCreditUsageRecord {
  const completedTaskIds = Array.isArray(record.completedTaskIds)
    ? [...new Set(record.completedTaskIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
  const chargedTaskIds = Array.isArray(record.chargedTaskIds)
    ? [...new Set(record.chargedTaskIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
  const refundedTaskIds = Array.isArray(record.refundedTaskIds)
    ? [...new Set(record.refundedTaskIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
  return {
    ...record,
    used: getGeminiLocalTaskUsage({ ...record, completedTaskIds, chargedTaskIds, refundedTaskIds }),
    externalUsed: 0,
    completedTaskIds,
    chargedTaskIds,
    refundedTaskIds,
    failedGenerateTaskIds: getGeminiGenerateFailureTaskIds(record),
  };
}

export function getGeminiCreditSnapshot(
  records: Record<string, GeminiCreditUsageRecord>,
  keys: string[]
): GeminiCreditSnapshot {
  const matchingRecords = [...new Set(keys)]
    .map((key) => records[key])
    .filter((record): record is GeminiCreditUsageRecord => Boolean(record));
  const used = matchingRecords.reduce((maximum, record) => {
    const normalized = normalizeGeminiUsageRecord(record);
    return Math.max(maximum, normalized.used || 0);
  }, 0);
  const boundedUsed = normalizeGeminiUsed(used);

  return {
    found: matchingRecords.length > 0,
    used: boundedUsed,
    remaining: GEMINI_VIDEO_CREDIT_LIMIT - boundedUsed,
    total: GEMINI_VIDEO_CREDIT_LIMIT,
  };
}

export function getGeminiAccountUsageKeys(email?: string, credential?: string): string[] {
  const keys: string[] = [];
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail?.includes('@')) keys.push(normalizedEmail);

  const value = (credential || '').trim();
  if (value.startsWith('AIza')) {
    keys.push(`key_${value.slice(-12)}`);
  }
  const psidMatch =
    value.match(/__Secure-1PSID=([^;]+)/i) ||
    value.match(/(?:^|;\s*)SID=([^;]+)/i);
  if (psidMatch?.[1]) {
    keys.push(crypto.createHash('sha256').update(psidMatch[1].trim()).digest('hex').slice(0, 16));
  } else if (value && !value.startsWith('AIza')) {
    keys.push(crypto.createHash('sha256').update(value).digest('hex').slice(0, 16));
  }

  return [...new Set(keys)];
}

export function readGeminiCreditLedger(): Record<string, GeminiCreditUsageRecord> {
  try {
    if (!fs.existsSync(GEMINI_USAGE_FILE)) return {};
    const parsed: unknown = JSON.parse(fs.readFileSync(GEMINI_USAGE_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Ledger Gemini harus berupa object.');
    }
    return parsed as Record<string, GeminiCreditUsageRecord>;
  } catch (error) {
    console.warn('[Gemini Credit Ledger] Could not read usage ledger:', error);
    return {};
  }
}
