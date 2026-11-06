/**
 * Gemini Account Manager & Auto-Switch Engine
 * Menyediakan utilitas terpadu untuk pengelolaan akun Google Gemini,
 * auto-switching akun cerdas saat kuota habis, serta sinkronisasi kredit realtime ke localStorage & Google Sheets.
 */

import { GEMINI_MAX_CREDITS } from './provider';

export interface GeminiAccount {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  token?: string;
  refreshToken?: string;
  apiKey?: string;
  cookies?: string;
  credits?: number;
  totalCredits?: number;
  creditsUsed?: number;
  isActive?: boolean;
  accountStatus?: 'active' | 'expired' | 'rate_limited';
  statusMessage?: string;
  lastUsed?: number;
  [key: string]: any;
}

function hasGeminiWebCookie(value?: string): boolean {
  return Boolean(value && /(?:__Secure-1PSID|(?:^|;\s*)SID=|(?:^|;\s*)SAPISID=)/i.test(value));
}

// 1. Membaca akun Google Gemini dari localStorage
export function getGeminiAccounts(): GeminiAccount[] {
  try {
    const raw = localStorage.getItem('gemini_accounts');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((a: any) => ({
      ...a,
      name: a.displayName || a.name || a.email || 'Akun Google',
      email: a.email || '',
      credits: typeof a.credits === 'number' ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, a.credits)) : 0,
      totalCredits: GEMINI_MAX_CREDITS,
    }));
  } catch (e) {
    console.warn('[GeminiAccountManager] Error reading gemini_accounts:', e);
    return [];
  }
}

// 2. Sinkronisasi akun ke Google Sheets
export async function syncGeminiAccountsToSheet(accounts: GeminiAccount[]): Promise<void> {
  try {
    const savedUser = localStorage.getItem('amb_active_user');
    const currentUser = savedUser ? JSON.parse(savedUser) : null;
    if (!currentUser?.userId || !Array.isArray(accounts)) return;

    await fetch('/api/providers/gemini/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.userId,
        accounts,
      }),
    });
  } catch (e) {
    console.warn('[GeminiAccountManager] Error syncing to Google Sheets:', e);
  }
}

// 3. Helper untuk memilih akun Gemini dengan sisa kuota cukup & Auto-Switch akun jika habis
export interface SelectAccountResult {
  account: GeminiAccount | null;
  wasAutoSwitched: boolean;
  previousAccount?: GeminiAccount | null;
  reason?: string;
}

export interface GeminiAccountLease {
  account: GeminiAccount;
  release: () => void;
}

interface GeminiAccountLeaseWaiter {
  requiredCredits: number;
  preferredAccountId?: string;
  exactAccountId?: string;
  onQueued?: () => void;
  resolve: (lease: GeminiAccountLease | null) => void;
  queuedNotified: boolean;
}

const reservedGeminiAccountIds = new Set<string>();
const busyGeminiAccountIds = new Set<string>();
const geminiAccountRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const geminiAccountLeaseQueue: GeminiAccountLeaseWaiter[] = [];

function getGeminiAccountLeaseKey(account: GeminiAccount): string {
  const identity = String(account.email || account.id || account.token || account.refreshToken || '').toLowerCase();
  let firstHash = 2166136261;
  let secondHash = 0x9e3779b9;
  for (let index = 0; index < identity.length; index++) {
    const code = identity.charCodeAt(index);
    firstHash = Math.imul(firstHash ^ code, 16777619);
    secondHash = Math.imul(secondHash ^ code, 2246822519);
  }
  return `gemini-${(firstHash >>> 0).toString(16)}-${(secondHash >>> 0).toString(16)}`;
}

function getEligibleGeminiAccounts(waiter: GeminiAccountLeaseWaiter): GeminiAccount[] {
  const accounts = getGeminiAccounts().filter((account) => {
    const token = (account.token || account.refreshToken || account.apiKey || account.cookies || '').trim();
    return (
      token.length > 0 &&
      (!account.accountStatus || account.accountStatus === 'active') &&
      (typeof account.credits === 'number' ? account.credits : 0) >= waiter.requiredCredits &&
      (!waiter.exactAccountId || account.id === waiter.exactAccountId)
    );
  });

  let activeId: string | null = null;
  try {
    activeId = localStorage.getItem('gemini_active_account_id');
  } catch (error) {
    console.warn('[GeminiAccountManager] Could not read selected account:', error);
  }
  accounts.sort((a, b) => {
    if (waiter.preferredAccountId && a.id === waiter.preferredAccountId) return -1;
    if (waiter.preferredAccountId && b.id === waiter.preferredAccountId) return 1;
    if (activeId && a.id === activeId) return -1;
    if (activeId && b.id === activeId) return 1;
    const creditsA = typeof a.credits === 'number' ? a.credits : 0;
    const creditsB = typeof b.credits === 'number' ? b.credits : 0;
    return creditsB - creditsA;
  });

  return accounts;
}

function tryAcquireGeminiBrowserLock(accountKey: string): Promise<(() => void) | null> {
  const lockManager = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!lockManager) return Promise.resolve(() => undefined);

  return new Promise((resolve) => {
    let resolved = false;
    void lockManager.request(
      `ambmedia-gemini-account:${accountKey}`,
      { ifAvailable: true },
      (lock) => {
        if (!lock) {
          resolved = true;
          resolve(null);
          return;
        }
        return new Promise<void>((releaseLock) => {
          resolved = true;
          resolve(releaseLock);
        });
      }
    ).catch((error) => {
      console.warn('[GeminiAccountManager] Browser account lock failed; using in-tab reservation:', error);
      if (!resolved) resolve(() => undefined);
    });
  });
}

function scheduleGeminiAccountRetry(accountKey: string): void {
  if (geminiAccountRetryTimers.has(accountKey)) return;
  busyGeminiAccountIds.add(accountKey);
  const timer = setTimeout(() => {
    geminiAccountRetryTimers.delete(accountKey);
    busyGeminiAccountIds.delete(accountKey);
    processGeminiAccountLeaseQueue();
  }, 500);
  geminiAccountRetryTimers.set(accountKey, timer);
}

function grantGeminiAccountLease(
  waiter: GeminiAccountLeaseWaiter,
  account: GeminiAccount,
  accountKey: string,
  releaseBrowserLock: () => void
): void {
  try {
    const currentActiveId = localStorage.getItem('gemini_active_account_id');
    if (currentActiveId !== account.id) {
      const updatedAccounts = getGeminiAccounts().map((candidate) => ({
        ...candidate,
        isActive: candidate.id === account.id,
      }));
      localStorage.setItem('gemini_accounts', JSON.stringify(updatedAccounts));
      localStorage.setItem('gemini_active_account_id', account.id);
      window.dispatchEvent(new Event('gemini_accounts_updated'));
      window.dispatchEvent(new Event('accounts-updated'));
      void syncGeminiAccountsToSheet(updatedAccounts);
    }
  } catch (error) {
    console.warn('[GeminiAccountManager] Could not persist selected account:', error);
  }

  let released = false;
  waiter.resolve({
    account,
    release: () => {
      if (released) return;
      released = true;
      reservedGeminiAccountIds.delete(accountKey);
      releaseBrowserLock();
      processGeminiAccountLeaseQueue();
    },
  });
}

function processGeminiAccountLeaseQueue(): void {
  for (let index = 0; index < geminiAccountLeaseQueue.length;) {
    const waiter = geminiAccountLeaseQueue[index];
    const eligibleAccounts = getEligibleGeminiAccounts(waiter);
    if (eligibleAccounts.length === 0) {
      geminiAccountLeaseQueue.splice(index, 1);
      waiter.resolve(null);
      continue;
    }

    const account = eligibleAccounts.find(
      (candidate) => {
        const key = getGeminiAccountLeaseKey(candidate);
        return !reservedGeminiAccountIds.has(key) && !busyGeminiAccountIds.has(key);
      }
    );
    if (!account) {
      if (!waiter.queuedNotified) {
        waiter.queuedNotified = true;
        waiter.onQueued?.();
      }
      index++;
      continue;
    }

    geminiAccountLeaseQueue.splice(index, 1);
    const accountKey = getGeminiAccountLeaseKey(account);
    reservedGeminiAccountIds.add(accountKey);
    void tryAcquireGeminiBrowserLock(accountKey).then((releaseBrowserLock) => {
      if (!releaseBrowserLock) {
        reservedGeminiAccountIds.delete(accountKey);
        if (!waiter.queuedNotified) {
          waiter.queuedNotified = true;
          waiter.onQueued?.();
        }
        geminiAccountLeaseQueue.unshift(waiter);
        scheduleGeminiAccountRetry(accountKey);
        processGeminiAccountLeaseQueue();
        return;
      }

      const refreshedAccount = getEligibleGeminiAccounts({
        ...waiter,
        exactAccountId: account.id,
      })[0];
      if (!refreshedAccount) {
        reservedGeminiAccountIds.delete(accountKey);
        releaseBrowserLock();
        waiter.resolve(null);
        processGeminiAccountLeaseQueue();
        return;
      }

      grantGeminiAccountLease(
        waiter,
        refreshedAccount,
        accountKey,
        releaseBrowserLock
      );
    });
  }
}

/**
 * Reserves one eligible Gemini account for a single in-flight generation.
 * If every eligible account is occupied, the request waits FIFO until one is released.
 */
export function acquireGeminiAccountLease(
  requiredCredits: number = 1,
  preferredAccountId?: string,
  options: { exactAccountId?: string; onQueued?: () => void } = {}
): Promise<GeminiAccountLease | null> {
  return new Promise((resolve) => {
    geminiAccountLeaseQueue.push({
      requiredCredits,
      preferredAccountId,
      exactAccountId: options.exactAccountId,
      onQueued: options.onQueued,
      resolve,
      queuedNotified: false,
    });
    processGeminiAccountLeaseQueue();
  });
}

export async function verifyAndSelectSufficientGeminiAccount(
  preferredAccountId?: string,
  requiredCredits: number = 1
): Promise<SelectAccountResult> {
  const allAccounts = getGeminiAccounts();
  if (allAccounts.length === 0) {
    return { account: null, wasAutoSwitched: false, reason: 'Belum ada akun Google Gemini yang terdaftar.' };
  }

  // Filter akun valid yang memiliki token/cookies/apiKey dan tidak expired
  const validAccounts = allAccounts.filter((a) => {
    const tok = (a.token || a.refreshToken || a.apiKey || a.cookies || '').trim();
    const isNotDead = !a.accountStatus || a.accountStatus === 'active';
    return tok.length > 0 && isNotDead;
  });

  if (validAccounts.length === 0) {
    return { account: null, wasAutoSwitched: false, reason: 'Semua akun Google Gemini telah kadaluarsa atau tidak memiliki token/cookies.' };
  }

  // Tentukan akun preferensi awal
  let initialAccount: GeminiAccount | null = null;
  const isAutoMode = !preferredAccountId || preferredAccountId === 'auto';

  if (!isAutoMode) {
    initialAccount = validAccounts.find((a) => a.id === preferredAccountId) || null;
  }

  if (!initialAccount) {
    try {
      const savedActiveId = localStorage.getItem('gemini_active_account_id');
      if (savedActiveId) {
        initialAccount = validAccounts.find((a) => a.id === savedActiveId) || null;
      }
    } catch (e) {}
  }

  if (!initialAccount) {
    initialAccount = validAccounts.find((a) => a.isActive) || validAccounts[0];
  }

  const currentCredits = typeof initialAccount.credits === 'number' ? initialAccount.credits : 0;

  // Kasus 1: Akun awal masih memiliki kredit yang mencukupi
  if (currentCredits >= requiredCredits && !isAutoMode) {
    return { account: initialAccount, wasAutoSwitched: false };
  }

  // Kasus 1B: Jika Auto Mode dan initialAccount masih ada kredit, gunakan
  if (isAutoMode && currentCredits >= requiredCredits) {
    return { account: initialAccount, wasAutoSwitched: false };
  }

  // Kasus 2: Akun awal kuotanya habis (0 kredit) atau kurang. Cari akun cadangan yang memiliki sisa kredit >= requiredCredits
  const candidates = validAccounts.filter((a) => a.id !== initialAccount?.id);

  // Urutkan kandidat berdasarkan kredit tertinggi
  candidates.sort((a, b) => {
    const credA = typeof a.credits === 'number' ? a.credits : 0;
    const credB = typeof b.credits === 'number' ? b.credits : 0;
    return credB - credA;
  });

  for (const candidate of candidates) {
    const cCredits = typeof candidate.credits === 'number' ? candidate.credits : 0;
    if (cCredits >= requiredCredits) {
      console.log(
        `[Gemini Auto-Switch ⚡] Akun "${initialAccount?.name || initialAccount?.email}" kuotanya habis (${currentCredits} kredit). Otomatis beralih ke akun cadangan "${candidate.name || candidate.email}" (sisa ${cCredits}/${GEMINI_MAX_CREDITS} kredit).`
      );

      // Perbarui akun aktif di localStorage & Sheets
      const updatedAccounts = allAccounts.map((a) => ({
        ...a,
        isActive: a.id === candidate.id,
      }));

      try {
        localStorage.setItem('gemini_accounts', JSON.stringify(updatedAccounts));
        localStorage.setItem('gemini_active_account_id', candidate.id);
        window.dispatchEvent(new Event('gemini_accounts_updated'));
        window.dispatchEvent(new Event('accounts-updated'));
        void syncGeminiAccountsToSheet(updatedAccounts);
      } catch (e) {}

      return {
        account: candidate,
        wasAutoSwitched: true,
        previousAccount: initialAccount,
        reason: `Akun "${initialAccount?.name || initialAccount?.email}" kuotanya habis. Otomatis beralih ke akun "${candidate.name || candidate.email}" (sisa ${cCredits}/${GEMINI_MAX_CREDITS} kredit).`,
      };
    }
  }

  // Jika semua akun sudah 0 kredit, kembalikan initialAccount sebagai fallback
  return {
    account: initialAccount,
    wasAutoSwitched: false,
    reason: 'Semua akun Google Gemini telah mencapai batas kuota harian (${GEMINI_MAX_CREDITS}/${GEMINI_MAX_CREDITS} kredit).',
  };
}

// 4. Menyusun payload akun & fallbackAccounts dengan urutan prioritas kredit tertinggi
export function buildGeminiPayloadAccounts(targetAccount: GeminiAccount) {
  const all = getGeminiAccounts();
  const fallbackAccounts = all
    .filter((a) => a.id !== targetAccount.id && (a.token || a.refreshToken || a.apiKey || a.cookies))
    .sort((a, b) => {
      const credA = typeof a.credits === 'number' ? a.credits : 0;
      const credB = typeof b.credits === 'number' ? b.credits : 0;
      return credB - credA; // Prioritaskan akun dengan sisa kuota terbesar
    })
    .map((a) => ({
      id: a.id,
      email: a.email,
      name: a.displayName || a.name || a.email,
      token: a.token || a.refreshToken || a.apiKey || a.cookies,
      apiKey: a.apiKey,
      cookies: a.cookies || (hasGeminiWebCookie(a.token) ? a.token : undefined),
      credits: a.credits,
    }));

  return {
    id: targetAccount.id,
    accountId: targetAccount.id,
    email: targetAccount.email,
    name: targetAccount.displayName || targetAccount.name || targetAccount.email,
    token: targetAccount.token || targetAccount.refreshToken || targetAccount.apiKey || targetAccount.cookies,
    apiKey: targetAccount.apiKey,
    cookies: targetAccount.cookies || (hasGeminiWebCookie(targetAccount.token) ? targetAccount.token : undefined),
    fallbackAccounts,
  };
}

// 5. Menandai akun yang kuotanya habis (0 kredit) berdasarkan respon server atau pesan error
export function handleGeminiExhaustedAccounts(data?: any, errMessage?: string, defaultAcc?: any): void {
  try {
    const raw = localStorage.getItem('gemini_accounts');
    if (!raw) return;
    const allGem = JSON.parse(raw);
    if (!Array.isArray(allGem) || allGem.length === 0) return;

    const exhaustedList = Array.isArray(data?.exhaustedAccounts) ? data.exhaustedAccounts : [];
    const exIds = new Set<string>();
    const exEmails = new Set<string>();
    const exNames = new Set<string>();

    for (const ex of exhaustedList) {
      if (ex?.id) exIds.add(String(ex.id));
      if (ex?.email) exEmails.add(String(ex.email).toLowerCase().trim());
      if (ex?.name) exNames.add(String(ex.name).toLowerCase().trim());
    }

    const textToCheck = `${errMessage || ''} ${data?.error || ''} ${data?.errorMessage || ''}`;
    const matchAccName = textToCheck.match(/Akun\s+["']([^"']+)["']/i);
    if (matchAccName && matchAccName[1]) {
      const extractedName = matchAccName[1].toLowerCase().trim();
      exNames.add(extractedName);
      if (extractedName.includes('@')) {
        exEmails.add(extractedName);
      }
    }

    const isQuotaRefusal =
      data?.isQuotaExhausted === true ||
      /mencapai kuota/i.test(textToCheck) ||
      /kuota.*habis/i.test(textToCheck) ||
      /tidak bisa membuatkan.*video.*hari ini/i.test(textToCheck) ||
      /tidak bisa membuatkan Anda video lagi hari ini/i.test(textToCheck) ||
      /batas kredit/i.test(textToCheck) ||
      /quota/i.test(textToCheck);

    if (isQuotaRefusal && defaultAcc) {
      if (defaultAcc.id) exIds.add(String(defaultAcc.id));
      if (defaultAcc.email) exEmails.add(String(defaultAcc.email).toLowerCase().trim());
      if (defaultAcc.name) exNames.add(String(defaultAcc.name).toLowerCase().trim());
      if (defaultAcc.displayName) exNames.add(String(defaultAcc.displayName).toLowerCase().trim());
    }

    if (exIds.size === 0 && exEmails.size === 0 && exNames.size === 0) return;

    let hasChanged = false;
    const updated = allGem.map((a: any) => {
      const aId = String(a.id || '');
      const aEmail = String(a.email || '').toLowerCase().trim();
      const aName = String(a.name || '').toLowerCase().trim();
      const aDisplay = String(a.displayName || '').toLowerCase().trim();

      const isMatch =
        exIds.has(aId) ||
        (aEmail && exEmails.has(aEmail)) ||
        (aName && exNames.has(aName)) ||
        (aDisplay && exNames.has(aDisplay)) ||
        (aEmail && exNames.has(aEmail.split('@')[0]));

      if (isMatch) {
        if (a.credits !== 0) {
          hasChanged = true;
        }
        return {
          ...a,
          credits: 0,
          totalCredits: GEMINI_MAX_CREDITS,
        };
      }
      return a;
    });

    if (hasChanged) {
      localStorage.setItem('gemini_accounts', JSON.stringify(updated));
      window.dispatchEvent(new Event('gemini_accounts_updated'));
      window.dispatchEvent(new Event('accounts-updated'));
      void syncGeminiAccountsToSheet(updated);
    }
  } catch (e) {
    console.warn('[handleGeminiExhaustedAccounts error]:', e);
  }
}

// 6. Update sisa kredit akun yang sukses digunakan
export function autoSyncGeminiAccountCredits(targetAcc: any, remainingCredits?: number, usedTotal?: number): void {
  try {
    if (!targetAcc) return;
    const raw = localStorage.getItem('gemini_accounts');
    if (!raw) return;
    const accounts = JSON.parse(raw);
    if (!Array.isArray(accounts) || accounts.length === 0) return;

    const targetId = targetAcc.id;
    const targetToken = targetAcc.token || targetAcc.refreshToken || targetAcc.apiKey || targetAcc.cookies;
    const targetEmail = targetAcc.email;

    let hasChanged = false;
    const updated = accounts.map((a: any) => {
      const match =
        (targetId && a.id === targetId) ||
        (targetEmail && a.email && a.email.toLowerCase() === targetEmail.toLowerCase()) ||
        (targetToken && (a.token === targetToken || a.refreshToken === targetToken || a.apiKey === targetToken || a.cookies === targetToken));

      if (match) {
        if (typeof remainingCredits === 'number') {
          const newCredit = Math.min(GEMINI_MAX_CREDITS, Math.max(0, remainingCredits));
          const newUsedTotal = typeof usedTotal === 'number'
            ? Math.min(GEMINI_MAX_CREDITS, Math.max(0, usedTotal))
            : GEMINI_MAX_CREDITS - newCredit;
          if (a.credits !== newCredit || a.creditsUsed !== newUsedTotal) {
            hasChanged = true;
            return { ...a, credits: newCredit, totalCredits: GEMINI_MAX_CREDITS, creditsUsed: newUsedTotal };
          }
        }
      }
      return a;
    });

    if (hasChanged) {
      localStorage.setItem('gemini_accounts', JSON.stringify(updated));
      window.dispatchEvent(new Event('gemini_accounts_updated'));
      window.dispatchEvent(new Event('accounts-updated'));
      void syncGeminiAccountsToSheet(updated);
    }
  } catch (e) {
    console.warn('[autoSyncGeminiAccountCredits error]:', e);
  }
}

export function markGeminiAccountSessionInvalid(
  targetAcc: Partial<Pick<GeminiAccount, 'id' | 'email' | 'token' | 'refreshToken' | 'apiKey' | 'cookies'>>,
  statusMessage = 'EXPIRED',
): void {
  try {
    const raw = localStorage.getItem('gemini_accounts');
    if (!raw) return;
    const accounts = JSON.parse(raw);
    if (!Array.isArray(accounts)) return;

    const targetId = targetAcc.id;
    const targetEmail = targetAcc.email?.toLowerCase();
    const targetToken = targetAcc.token || targetAcc.refreshToken || targetAcc.apiKey || targetAcc.cookies;
    let matched = false;
    const updated = accounts.map((account: GeminiAccount) => {
      const isTarget =
        (targetId && account.id === targetId) ||
        (targetEmail && account.email?.toLowerCase() === targetEmail) ||
        (targetToken &&
          [account.token, account.refreshToken, account.apiKey, account.cookies].includes(targetToken));
      if (!isTarget) return account;
      matched = true;
      return {
        ...account,
        credits: 0,
        creditsUsed: GEMINI_MAX_CREDITS,
        isActive: false,
        accountStatus: 'expired' as const,
        statusMessage,
      };
    });
    if (!matched) return;

    const activeId = localStorage.getItem('gemini_active_account_id');
    const invalidatedActiveAccount = updated.some(
      (account: GeminiAccount) => account.id === activeId && account.accountStatus === 'expired',
    );
    if (invalidatedActiveAccount) {
      const nextActive = updated.find(
        (account: GeminiAccount) => !account.accountStatus || account.accountStatus === 'active',
      );
      for (const account of updated) account.isActive = account.id === nextActive?.id;
      if (nextActive) localStorage.setItem('gemini_active_account_id', nextActive.id);
      else localStorage.removeItem('gemini_active_account_id');
    }

    localStorage.setItem('gemini_accounts', JSON.stringify(updated));
    window.dispatchEvent(new Event('gemini_accounts_updated'));
    window.dispatchEvent(new Event('accounts-updated'));
    void syncGeminiAccountsToSheet(updated);
  } catch (error) {
    console.warn('[GeminiAccountManager] Could not mark expired session:', error);
  }
}

// 7. Terapkan switch akun jika server merotasi akun
export function applyGeminiAccountSwitch(usedAccount: any): void {
  try {
    if (!usedAccount?.id && !usedAccount?.email) return;
    const allGem = getGeminiAccounts();
    const targetId = usedAccount.id;
    const targetEmail = usedAccount.email ? String(usedAccount.email).toLowerCase() : '';

    const updated = allGem.map((a: any) => ({
      ...a,
      isActive: (targetId && a.id === targetId) || (targetEmail && a.email && a.email.toLowerCase() === targetEmail),
    }));

    localStorage.setItem('gemini_accounts', JSON.stringify(updated));
    if (targetId) {
      localStorage.setItem('gemini_active_account_id', targetId);
    }
    window.dispatchEvent(new Event('gemini_accounts_updated'));
    window.dispatchEvent(new Event('accounts-updated'));
    void syncGeminiAccountsToSheet(updated);
  } catch (e) {
    console.warn('[applyGeminiAccountSwitch error]:', e);
  }
}
