import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import {
  GEMINI_VIDEO_CREDIT_LIMIT,
  getGeminiAccountUsageKeys,
  getGeminiCreditSnapshot,
  readGeminiCreditLedger,
} from './geminiCreditLedger';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1iO2iKP0QWS59wZUk5Mtv5ubaH7YQiskFzg6aJj5OaNU';

function getAuth() {
  const keyPath = path.join(process.cwd(), 'google-service-account.json');
  if (!fs.existsSync(keyPath)) {
    throw new Error('google-service-account.json tidak ditemukan di root server.');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  return auth;
}

export function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

export interface UserSheetRecord {
  rowIndex: number;
  userId: string;
  userName: string;
  password: string;
  email: string;
}

// Helper to get column letter from 0-indexed number (0 -> A, 1 -> B, etc)
function columnToLetter(column: number): string {
  let temp: number;
  let letter = '';
  let col = column + 1;
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

export async function getUsersSheetData() {
  const sheets = getSheetsClient();
  const range = `'User'!A1:Z1000`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) {
    return {
      headers: ['User_id', 'User_name', 'Password', 'Email'],
      userIdIdx: 0,
      userNameIdx: 1,
      passwordIdx: 2,
      emailIdx: 3,
      users: [] as UserSheetRecord[],
    };
  }

  const headers = rows[0].map((h: string) => (h || '').trim());
  const findIdx = (keywords: string[]) => {
    return headers.findIndex((h: string) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return keywords.some((k) => clean === k);
    });
  };

  const userIdIdx = findIdx(['userid', 'iduser', 'id']);
  const userNameIdx = findIdx(['username', 'namauser', 'user', 'nama']);
  const passwordIdx = findIdx(['password', 'pass', 'sandi']);
  const emailIdx = findIdx(['email', 'mail', 'surel']);

  const actualUserIdIdx = userIdIdx >= 0 ? userIdIdx : 0;
  const actualUserNameIdx = userNameIdx >= 0 ? userNameIdx : 1;
  const actualPasswordIdx = passwordIdx >= 0 ? passwordIdx : 2;
  const actualEmailIdx = emailIdx >= 0 ? emailIdx : 3;

  const users: UserSheetRecord[] = rows.slice(1).map((row: any[], index: number) => {
    return {
      rowIndex: index + 2, // 1-based, header is 1
      userId: row[actualUserIdIdx] ? String(row[actualUserIdIdx]).trim() : '',
      userName: row[actualUserNameIdx] ? String(row[actualUserNameIdx]).trim() : '',
      password: row[actualPasswordIdx] ? String(row[actualPasswordIdx]).trim() : '',
      email: row[actualEmailIdx] ? String(row[actualEmailIdx]).trim() : '',
    };
  });

  return {
    headers,
    userIdIdx: actualUserIdIdx,
    userNameIdx: actualUserNameIdx,
    passwordIdx: actualPasswordIdx,
    emailIdx: actualEmailIdx,
    users,
  };
}

export async function loginUserWithSpreadsheet(usernameInput: string, passwordInput: string) {
  const cleanUsername = (usernameInput || '').trim();
  const cleanPassword = (passwordInput || '').trim();

  if (!cleanUsername || !cleanPassword) {
    return { success: false, error: 'Username dan Password wajib diisi.' };
  }

  const { users, userIdIdx, passwordIdx, emailIdx } = await getUsersSheetData();
  const user = users.find(
    (u) => u.userName.toLowerCase() === cleanUsername.toLowerCase()
  );

  if (!user) {
    return {
      success: false,
      error: 'Username atau password salah.',
    };
  }

  const currentPassword = user.password;
  if (!currentPassword) {
    return { success: false, error: 'Username atau password salah.' };
  }

  const isBcrypt = currentPassword.startsWith('$2a$') || currentPassword.startsWith('$2b$') || currentPassword.startsWith('$2y$');
  let passwordMatches = false;
  let needsPasswordHashUpdate = false;

  if (isBcrypt) {
    passwordMatches = await bcrypt.compare(cleanPassword, currentPassword);
  } else {
    // Plain text comparison
    passwordMatches = (cleanPassword === currentPassword);
    if (passwordMatches) {
      needsPasswordHashUpdate = true;
    }
  }

  if (!passwordMatches) {
    return { success: false, error: 'Username atau password salah.' };
  }

  const sheets = getSheetsClient();
  const updates: { range: string; values: string[][] }[] = [];

  // 1. Check if password needs to be hashed and updated in Spreadsheet
  let finalHashedPassword = currentPassword;
  if (needsPasswordHashUpdate) {
    finalHashedPassword = await bcrypt.hash(cleanPassword, 10);
    const passColLetter = columnToLetter(passwordIdx);
    updates.push({
      range: `'User'!${passColLetter}${user.rowIndex}`,
      values: [[finalHashedPassword]],
    });
    console.log(`[Google Sheets Auth] Password user "${user.userName}" otomatis di-hash dan diupdate ke cell ${passColLetter}${user.rowIndex}.`);
  }

  // 2. Check if User_id is empty -> auto-generate & update in Spreadsheet
  let finalUserId = user.userId;
  if (!finalUserId) {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    finalUserId = `USR-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;
    const userColLetter = columnToLetter(userIdIdx);
    updates.push({
      range: `'User'!${userColLetter}${user.rowIndex}`,
      values: [[finalUserId]],
    });
    console.log(`[Google Sheets Auth] User_id kosong untuk "${user.userName}". Otomatis di-generate "${finalUserId}" dan ditulis ke cell ${userColLetter}${user.rowIndex}.`);
  }

  // Execute batch update if there are changes
  if (updates.length > 0) {
    try {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });
    } catch (err: any) {
      console.error('[Google Sheets Auth] Gagal menyimpan update user_id / hash password ke sheet:', err.message);
    }
  }

  const firstName = user.userName.split(' ')[0] || user.userName;

  return {
    success: true,
    user: {
      userId: finalUserId,
      userName: user.userName,
      firstName: firstName,
      email: user.email || '',
    },
  };
}

export async function registerUserToSpreadsheet(usernameInput: string, passwordInput: string, emailInput: string) {
  const cleanUsername = (usernameInput || '').trim();
  const cleanPassword = (passwordInput || '').trim();
  const cleanEmail = (emailInput || '').trim();

  if (!cleanUsername || !cleanPassword) {
    return { success: false, error: 'Username dan Password wajib diisi.' };
  }

  const { users } = await getUsersSheetData();
  const existing = users.find(
    (u) => u.userName.toLowerCase() === cleanUsername.toLowerCase()
  );

  if (existing) {
    return { success: false, error: `Username "${cleanUsername}" sudah terdaftar di database Spreadsheet.` };
  }

  const hashedPassword = await bcrypt.hash(cleanPassword, 10);
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const newUserId = `USR-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'User'!A:D`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[newUserId, cleanUsername, hashedPassword, cleanEmail]],
    },
  });

  const firstName = cleanUsername.split(' ')[0] || cleanUsername;

  return {
    success: true,
    user: {
      userId: newUserId,
      userName: cleanUsername,
      firstName: firstName,
      email: cleanEmail,
    },
  };
}

export const PROVIDER_SHEET_MAP: Record<string, string> = {
  weavy: 'Weavy_Accounts',
  gemini: 'Gemini_Accounts',
  flow: 'Flow_Accounts',
  vids: 'Vids_Accounts',
  roboneo: 'RoboNeo_Accounts',
  galleri5: 'Galleri5_Accounts',
  kie: 'Kie.ai_Accounts',
  runninghub: 'RunningHub_Accounts',
};

export const STRUCTURED_ACCOUNT_HEADERS = [
  'User_id',
  'Account_id',
  'Email',
  'Name',
  'Display_Name',
  'Is_Active',
  'Has_Refresh_Token',
  'Refresh_Token',
  'Credits',
  'Total_Credits',
  'Credits_Used',
  'Raw_Json',
];

// In-memory cache for sheet metadata and verified sheet titles
const verifiedSheetsCache = new Set<string>();

// In-memory cache for sheet rows data to prevent Google Sheets 429 quota exhaustion
interface CachedSheetData {
  rows: any[][];
  fetchedAt: number;
}
const sheetDataCache = new Map<string, CachedSheetData>();
const DATA_CACHE_TTL_MS = 60 * 1000; // 60 seconds read cache

export function invalidateProviderAccountsCache(providerKey: string): void {
  const sheetTitle = PROVIDER_SHEET_MAP[providerKey.toLowerCase()] || `${providerKey}_Accounts`;
  sheetDataCache.delete(sheetTitle);
}

// Helper to execute Google Sheets operations with exponential backoff on 429 quota errors
async function executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 4, initialDelayMs = 1500): Promise<T> {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const errMsg = err?.message || '';
      const isQuotaError =
        errMsg.includes('Quota exceeded') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('429') ||
        errMsg.includes('Read requests per minute') ||
        errMsg.includes('Write requests per minute');

      if (isQuotaError && attempt < maxRetries) {
        console.warn(`[Google Sheets] Quota hit (attempt ${attempt}/${maxRetries}), backing off for ${delay}ms...`);
        await new Promise((res) => setTimeout(res, delay + Math.random() * 500));
        delay *= 2; // exponential backoff
      } else {
        throw err;
      }
    }
  }
  throw new Error('Google Sheets request failed after retries.');
}

export async function ensureProviderSheet(sheetTitle: string) {
  const normalizedTitle = sheetTitle.toLowerCase();
  if (verifiedSheetsCache.has(normalizedTitle)) {
    return;
  }

  const sheets = getSheetsClient();
  try {
    const meta = await executeWithRetry(() =>
      sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      })
    );

    (meta.data.sheets || []).forEach((s) => {
      if (s.properties?.title) {
        verifiedSheetsCache.add(s.properties.title.toLowerCase());
      }
    });

    const sheetExists = verifiedSheetsCache.has(normalizedTitle);

    if (!sheetExists) {
      await executeWithRetry(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetTitle,
                  },
                },
              },
            ],
          },
        })
      );

      verifiedSheetsCache.add(normalizedTitle);

      // Add structured headers
      await executeWithRetry(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${sheetTitle}'!A1:L1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [STRUCTURED_ACCOUNT_HEADERS],
          },
        })
      );
    }
  } catch (err: any) {
    console.warn(`[Google Sheets] Warning ensureProviderSheet for ${sheetTitle}:`, err.message);
  }
}

export async function getProviderAccountsFromSheet(
  userId: string,
  providerKey: string,
  strict = false,
  forceRefresh = false,
) {
  const cleanUserId = (userId || '').trim();
  if (!cleanUserId) return [];

  const sheetTitle = PROVIDER_SHEET_MAP[providerKey.toLowerCase()] || `${providerKey}_Accounts`;
  const sheets = getSheetsClient();
  const isGeminiProvider = providerKey.toLowerCase() === 'gemini';
  const geminiUsageLedger = isGeminiProvider ? readGeminiCreditLedger() : {};

  try {
    // 1. Check in-memory cache first to avoid hitting Google Sheets Read Quota
    const cached = sheetDataCache.get(sheetTitle);
    let rows: any[][] = [];

    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < DATA_CACHE_TTL_MS) {
      rows = cached.rows;
    } else {
      try {
        const response = await executeWithRetry(() =>
          sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${sheetTitle}'!A1:Z5000`,
          })
        );
        rows = response.data.values || [];
        sheetDataCache.set(sheetTitle, { rows, fetchedAt: Date.now() });
      } catch (fetchErr: any) {
        // If quota exceeded or error, fall back to stale cache if present
        if (!forceRefresh && cached && cached.rows.length > 0) {
          console.warn(`[Google Sheets] Menggunakan cache data fallback untuk ${sheetTitle} karena error:`, fetchErr.message);
          rows = cached.rows;
        } else {
          throw fetchErr;
        }
      }
    }

    if (rows.length <= 1) return [];

    const headers = rows[0].map((h: string) => (h || '').trim().toLowerCase());
    let userIdIdx = headers.findIndex((h: string) => h === 'user_id' || h === 'userid' || h === 'id');
    let accIdIdx = headers.findIndex((h: string) => h === 'account_id' || h === 'accountid' || h === 'acc_id');
    let emailIdx = headers.findIndex((h: string) => h === 'email' || h === 'surel');
    let nameIdx = headers.findIndex((h: string) => h === 'name' || h === 'nama');
    let dispNameIdx = headers.findIndex((h: string) => h === 'display_name' || h === 'displayname');
    let isActiveIdx = headers.findIndex((h: string) => h === 'is_active' || h === 'isactive' || h === 'active');
    let hasRefreshIdx = headers.findIndex((h: string) => h === 'has_refresh_token' || h === 'hasrefreshtoken');
    let refreshTokenIdx = headers.findIndex((h: string) => h === 'refresh_token' || h === 'refreshtoken' || h === 'token' || h === 'key' || h === 'apikey');
    let creditsIdx = headers.findIndex((h: string) => h === 'credits' || h === 'credit' || h === 'kredit');
    let totalCreditsIdx = headers.findIndex((h: string) => h === 'total_credits' || h === 'totalcredits');
    let creditsUsedIdx = headers.findIndex((h: string) => h === 'credits_used' || h === 'creditsused');
    let rawJsonIdx = headers.findIndex((h: string) => h === 'raw_json' || h === 'rawjson' || h === 'settings' || h === 'setting' || h === 'accounts' || h === 'config');

    if (userIdIdx < 0) userIdIdx = 0;

    const accountsMap = new Map<string, any>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowUserId = row[userIdIdx] ? String(row[userIdIdx]).trim() : '';
      if (rowUserId.toLowerCase() !== cleanUserId.toLowerCase()) continue;

      // 1. Try parse JSON if rawJsonIdx exists and has valid content
      let parsedJson: any = null;
      if (rawJsonIdx >= 0 && row[rawJsonIdx]) {
        const raw = String(row[rawJsonIdx]).trim();
        if (raw.startsWith('{') || raw.startsWith('[')) {
          try {
            parsedJson = JSON.parse(raw);
          } catch (e) {
            // ignore invalid JSON
          }
        }
      }

      if (parsedJson) {
        const isRunningHub = providerKey.toLowerCase() === 'runninghub';
        const isGemini = providerKey.toLowerCase() === 'gemini';
        const normalizeItem = (item: any, fallbackIdx: number) => {
          if (!item) return null;
          const email = String(item.email || '').trim();
          let refreshToken = String(item.refreshToken || item.apiKey || item.accessToken || item.token || '').trim();
          const id = String(item.id || `acc-${Date.now()}-${fallbackIdx}`).trim();
          const name = String(item.name || item.displayName || '').trim();
          const displayName = String(item.displayName || item.name || '').trim();
          const isActive = item.isActive === true || item.isActive === 'TRUE' || item.isActive === 1 || item.isActive === '1';
          let hasRefreshToken = item.hasRefreshToken === true || item.hasRefreshToken === 'TRUE' || !!refreshToken;
          let creditsVal = typeof item.credits === 'number' ? item.credits : (item.credits !== undefined && !isNaN(Number(item.credits)) ? Number(item.credits) : (isGemini ? 0 : 0));
          let totalCreditsVal = isRunningHub ? undefined : (typeof item.totalCredits === 'number' ? item.totalCredits : (item.totalCredits !== undefined && !isNaN(Number(item.totalCredits)) ? Number(item.totalCredits) : (isGemini ? GEMINI_VIDEO_CREDIT_LIMIT : undefined)));
          let creditsUsedVal = typeof item.creditsUsed === 'number' ? item.creditsUsed : (item.creditsUsed !== undefined && !isNaN(Number(item.creditsUsed)) ? Number(item.creditsUsed) : undefined);
          let creditSyncStatus: 'synced' | 'unknown' | undefined;

          if (isGemini) {
            if (!refreshToken && email) {
              try {
                const { getCookiesForGeminiEmail } = require('./geminiProfileCookies');
                const resolvedCookies = getCookiesForGeminiEmail(email);
                if (resolvedCookies) {
                  refreshToken = resolvedCookies;
                  hasRefreshToken = true;
                }
              } catch (e) {}
            }
            const snapshot = getGeminiCreditSnapshot(
              geminiUsageLedger,
              getGeminiAccountUsageKeys(email, refreshToken)
            );
            if (snapshot.found) {
              creditsVal = snapshot.remaining;
              creditsUsedVal = snapshot.used;
            } else {
              creditsVal = Math.min(GEMINI_VIDEO_CREDIT_LIMIT, Math.max(0, creditsVal));
              creditsUsedVal ??= GEMINI_VIDEO_CREDIT_LIMIT - creditsVal;
            }
            creditSyncStatus = snapshot.found ? 'synced' : 'unknown';
            totalCreditsVal = GEMINI_VIDEO_CREDIT_LIMIT;
          }

          return {
            id,
            email,
            name: name || displayName,
            displayName: displayName || name,
            isActive,
            hasRefreshToken,
            refreshToken,
            credits: isNaN(creditsVal) ? 0 : creditsVal,
            totalCredits: totalCreditsVal,
            creditsUsed: creditsUsedVal,
            creditSyncStatus,
          };
        };

        if (Array.isArray(parsedJson)) {
          for (let pIdx = 0; pIdx < parsedJson.length; pIdx++) {
            const item = parsedJson[pIdx];
            const normalized = normalizeItem(item, pIdx);
            if (normalized && (normalized.id || normalized.email || normalized.refreshToken)) {
              const key = (normalized.refreshToken || '').trim() || (normalized.email && !normalized.email.startsWith('rh_') ? normalized.email.trim().toLowerCase() : '') || normalized.id;
              accountsMap.set(key, normalized);
            }
          }
          continue;
        } else if (typeof parsedJson === 'object') {
          const normalized = normalizeItem(parsedJson, i);
          if (normalized && (normalized.id || normalized.email || normalized.refreshToken)) {
            const key = (normalized.refreshToken || '').trim() || (normalized.email && !normalized.email.startsWith('rh_') ? normalized.email.trim().toLowerCase() : '') || normalized.id || `acc-${i}`;
            accountsMap.set(key, normalized);
          }
          continue;
        }
      }

      // 2. Structured row parsing
      const accId = (accIdIdx >= 0 && row[accIdIdx]) ? String(row[accIdIdx]).trim() : '';
      const email = (emailIdx >= 0 && row[emailIdx]) ? String(row[emailIdx]).trim() : '';
      const name = (nameIdx >= 0 && row[nameIdx]) ? String(row[nameIdx]).trim() : '';
      const displayName = (dispNameIdx >= 0 && row[dispNameIdx]) ? String(row[dispNameIdx]).trim() : name;
      const isActiveRaw = (isActiveIdx >= 0 && row[isActiveIdx]) ? String(row[isActiveIdx]).trim().toUpperCase() : 'FALSE';
      const isActive = isActiveRaw === 'TRUE' || isActiveRaw === '1' || isActiveRaw === 'YES';
      const hasRefreshRaw = (hasRefreshIdx >= 0 && row[hasRefreshIdx]) ? String(row[hasRefreshIdx]).trim().toUpperCase() : 'FALSE';
      let refreshToken = (refreshTokenIdx >= 0 && row[refreshTokenIdx]) ? String(row[refreshTokenIdx]).trim() : '';
      const hasRefreshToken = hasRefreshRaw === 'TRUE' || !!refreshToken;

      const isRunningHub = providerKey.toLowerCase() === 'runninghub';
      const isGemini = providerKey.toLowerCase() === 'gemini';
      const isFlow = providerKey.toLowerCase() === 'flow';
      const isVids = providerKey.toLowerCase() === 'vids';
      const defaultProviderCredits = isGemini ? 0 : (isFlow ? 50 : (isVids ? 500 : (providerKey.toLowerCase() === 'galleri5' ? 100 : (providerKey.toLowerCase() === 'kie' ? 80 : (isRunningHub ? 600 : 150)))));
      const rawCreditNum = (creditsIdx >= 0 && row[creditsIdx] !== undefined && String(row[creditsIdx]).trim() !== '') ? Number(row[creditsIdx]) : NaN;
      let creditsVal = !isNaN(rawCreditNum) ? rawCreditNum : defaultProviderCredits;
      let totalCreditsVal = (totalCreditsIdx >= 0 && row[totalCreditsIdx] !== undefined && String(row[totalCreditsIdx]).trim() !== '') ? Number(row[totalCreditsIdx]) : (isGemini ? GEMINI_VIDEO_CREDIT_LIMIT : (isVids ? 500 : undefined));
      if (isRunningHub) {
        totalCreditsVal = undefined;
      }
      let creditsUsedVal = (creditsUsedIdx >= 0 && row[creditsUsedIdx] !== undefined && String(row[creditsUsedIdx]).trim() !== '') ? Number(row[creditsUsedIdx]) : undefined;
      let creditSyncStatus: 'synced' | 'unknown' | undefined;

      if (isGemini) {
        if (!refreshToken && email) {
          try {
            const { getCookiesForGeminiEmail } = require('./geminiProfileCookies');
            const resolvedCookies = getCookiesForGeminiEmail(email);
            if (resolvedCookies) {
              refreshToken = resolvedCookies;
            }
          } catch (e) {}
        }
        const snapshot = getGeminiCreditSnapshot(
          geminiUsageLedger,
          getGeminiAccountUsageKeys(email, refreshToken)
        );
        if (snapshot.found) {
          creditsVal = snapshot.remaining;
          totalCreditsVal = snapshot.total;
          creditsUsedVal = snapshot.used;
        } else {
          creditsVal = Number.isFinite(creditsVal)
            ? Math.min(GEMINI_VIDEO_CREDIT_LIMIT, Math.max(0, creditsVal))
            : 0;
          creditsUsedVal ??= GEMINI_VIDEO_CREDIT_LIMIT - creditsVal;
          totalCreditsVal = GEMINI_VIDEO_CREDIT_LIMIT;
        }
        creditSyncStatus = snapshot.found ? 'synced' : 'unknown';
      }
      if (accId || email || refreshToken) {
        const hasValidToken = hasRefreshToken || Boolean(refreshToken);
        const key = (email && !email.startsWith('rh_') ? email.trim().toLowerCase() : '') || (refreshToken || '').trim() || accId || `acc-${i}`;
        accountsMap.set(key, {
          id: accId || `acc-${Date.now()}-${i}`,
          email,
          name: name || displayName,
          displayName: displayName || name,
          isActive,
          hasRefreshToken: hasValidToken,
          refreshToken,
          credits: isNaN(creditsVal) ? defaultProviderCredits : creditsVal,
          totalCredits: isGemini
            ? GEMINI_VIDEO_CREDIT_LIMIT
            : ((totalCreditsVal !== undefined && !isNaN(totalCreditsVal)) ? totalCreditsVal : (isFlow ? 50 : (isVids ? 500 : undefined))),
          creditsUsed: (creditsUsedVal !== undefined && !isNaN(creditsUsedVal)) ? creditsUsedVal : undefined,
          creditSyncStatus,
        });
      }
    }

    return Array.from(accountsMap.values());
  } catch (err: any) {
    console.warn(`[Google Sheets] Gagal getProviderAccountsFromSheet ${sheetTitle}:`, err.message);
    if (strict) throw err;
    return [];
  }
}

export async function saveProviderAccountsToSheet(userId: string, providerKey: string, accounts: any[]) {
  const cleanUserId = (userId || '').trim();
  if (!cleanUserId) {
    throw new Error('User_id diperlukan untuk menyimpan akun provider ke Google Sheets.');
  }

  const sheetTitle = PROVIDER_SHEET_MAP[providerKey.toLowerCase()] || `${providerKey}_Accounts`;
  await ensureProviderSheet(sheetTitle);

  const sheets = getSheetsClient();
  const range = `'${sheetTitle}'!A1:Z5000`;

  let rows: any[][] = [];
  const cached = sheetDataCache.get(sheetTitle);
  if (cached && Date.now() - cached.fetchedAt < DATA_CACHE_TTL_MS) {
    rows = cached.rows;
  } else {
    try {
      const response = await executeWithRetry(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range,
        })
      );
      rows = response.data.values || [];
      sheetDataCache.set(sheetTitle, { rows, fetchedAt: Date.now() });
    } catch (e: any) {
      if (cached && cached.rows.length > 0) {
        rows = cached.rows;
      }
    }
  }

  let userIdIdx = 0;

  if (rows.length > 0) {
    const headers = rows[0].map((h: string) => (h || '').trim().toLowerCase());
    const uIdx = headers.findIndex((h: string) => h === 'user_id' || h === 'userid' || h === 'id');
    if (uIdx >= 0) userIdIdx = uIdx;
  }

  // Preserve all other users' rows
  const otherUsersRows: any[][] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowUserId = row[userIdIdx] ? String(row[userIdIdx]).trim() : '';
    if (rowUserId && rowUserId.toLowerCase() !== cleanUserId.toLowerCase()) {
      otherUsersRows.push(row);
    }
  }

  const isRunningHub = providerKey.toLowerCase() === 'runninghub';
  const isGemini = providerKey.toLowerCase() === 'gemini';
  const isFlow = providerKey.toLowerCase() === 'flow';
  const isVids = providerKey.toLowerCase() === 'vids';

  // Sanitize & deduplicate accounts payload (updates existing accounts by API Key / Token / Email)
  const deduplicatedMap = new Map<string, any>();
  const rawAccounts = Array.isArray(accounts) ? accounts : [];

  for (let idx = 0; idx < rawAccounts.length; idx++) {
    const acc = rawAccounts[idx];
    if (!acc) continue;

    const tokenKey = String(acc.refreshToken || acc.apiKey || acc.accessToken || acc.token || acc.cookies || '').trim();
    const emailKey = String(acc.email || '').trim().toLowerCase();
    const isGenericEmail = (isFlow && (emailKey.startsWith('flow_user_') || emailKey.startsWith('flow_') || emailKey === 'flow.user@google.com')) || (isVids && (emailKey.startsWith('vids_user_') || emailKey.startsWith('vids_') || emailKey === 'vids.user@google.com')) || emailKey.startsWith('rh_');
    const uniqueKey = tokenKey || (!isGenericEmail && emailKey ? emailKey : '') || String(acc.id || `acc-${idx}`);

    const normalizedAcc = {
      id: acc.id || `acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: acc.email || '',
      name: acc.name || acc.displayName || '',
      displayName: acc.displayName || acc.name || '',
      isActive: !!acc.isActive,
      hasRefreshToken: !!acc.hasRefreshToken || !!acc.refreshToken || !!tokenKey,
      refreshToken: tokenKey,
      credits: isGemini
        ? (typeof acc.credits === 'number'
            ? Math.min(GEMINI_VIDEO_CREDIT_LIMIT, Math.max(0, acc.credits))
            : 0)
        : (typeof acc.credits === 'number' ? acc.credits : (isFlow ? 50 : (isVids ? 500 : (providerKey.toLowerCase() === 'galleri5' ? 100 : (providerKey.toLowerCase() === 'kie' ? 80 : 0))))),
      totalCredits: isRunningHub
        ? undefined
        : (isGemini
            ? GEMINI_VIDEO_CREDIT_LIMIT
            : (typeof acc.totalCredits === 'number' ? acc.totalCredits : (isFlow ? 50 : (isVids ? 500 : undefined)))),
      creditsUsed: isGemini
        ? (typeof acc.creditsUsed === 'number'
            ? Math.min(GEMINI_VIDEO_CREDIT_LIMIT, Math.max(0, acc.creditsUsed))
            : (typeof acc.credits === 'number'
                ? GEMINI_VIDEO_CREDIT_LIMIT - Math.min(GEMINI_VIDEO_CREDIT_LIMIT, Math.max(0, acc.credits))
                : undefined))
        : (typeof acc.creditsUsed === 'number' ? acc.creditsUsed : undefined),
    };

    if (deduplicatedMap.has(uniqueKey)) {
      const existing = deduplicatedMap.get(uniqueKey);
      deduplicatedMap.set(uniqueKey, {
        ...existing,
        ...normalizedAcc,
        id: existing.id || normalizedAcc.id,
        email: normalizedAcc.email || existing.email,
        name: normalizedAcc.name || existing.name,
        displayName: normalizedAcc.displayName || existing.displayName,
        credits: normalizedAcc.credits !== undefined ? normalizedAcc.credits : existing.credits,
        totalCredits: normalizedAcc.totalCredits !== undefined ? normalizedAcc.totalCredits : existing.totalCredits,
        creditsUsed: normalizedAcc.creditsUsed !== undefined ? normalizedAcc.creditsUsed : existing.creditsUsed,
        refreshToken: normalizedAcc.refreshToken || existing.refreshToken,
        isActive: normalizedAcc.isActive !== undefined ? normalizedAcc.isActive : existing.isActive,
      });
    } else {
      deduplicatedMap.set(uniqueKey, normalizedAcc);
    }
  }

  const finalAccounts = Array.from(deduplicatedMap.values());

  // Build rows for current user (1 row per account to prevent 50,000 char cell limits)
  const currentUserRows: any[][] = finalAccounts.map((acc: any) => {
    const compactJson = JSON.stringify({
      id: acc.id,
      email: acc.email,
      name: acc.name,
      displayName: acc.displayName,
      isActive: acc.isActive,
      hasRefreshToken: acc.hasRefreshToken,
      refreshToken: acc.refreshToken,
      credits: acc.credits,
      ...(isRunningHub ? {} : (acc.totalCredits !== undefined ? { totalCredits: acc.totalCredits } : {})),
      creditsUsed: acc.creditsUsed,
    });

    return [
      cleanUserId,
      acc.id,
      acc.email,
      acc.name,
      acc.displayName,
      acc.isActive ? 'TRUE' : 'FALSE',
      acc.hasRefreshToken ? 'TRUE' : 'FALSE',
      acc.refreshToken,
      acc.credits !== undefined ? String(acc.credits) : '0',
      isRunningHub ? '' : (acc.totalCredits !== undefined ? String(acc.totalCredits) : ''),
      acc.creditsUsed !== undefined ? String(acc.creditsUsed) : '',
      compactJson,
    ];
  });

  const fullData: any[][] = [
    STRUCTURED_ACCOUNT_HEADERS,
    ...otherUsersRows,
    ...currentUserRows,
  ];

  // Clear existing content to remove stale trailing rows
  try {
    await executeWithRetry(() =>
      sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetTitle}'!A1:Z5000`,
      })
    );
  } catch (clearErr: any) {
    console.warn(`[Google Sheets] Warning clear sheet ${sheetTitle}:`, clearErr.message);
  }

  // Update with structured rows
  await executeWithRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetTitle}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: fullData,
      },
    })
  );

  // Update in-memory cache immediately
  sheetDataCache.set(sheetTitle, { rows: fullData, fetchedAt: Date.now() });

  console.log(`[Google Sheets] Berhasil sinkronisasi ${finalAccounts.length} akun provider "${sheetTitle}" untuk User_id ${cleanUserId} (Total baris: ${fullData.length}).`);

  return { success: true, count: finalAccounts.length };
}

export async function getAllProvidersAccountsFromSheet(userId: string) {
  const cleanUserId = (userId || '').trim();
  if (!cleanUserId) {
    return { weavy: [], gemini: [], flow: [], vids: [], roboneo: [], galleri5: [], kie: [], runninghub: [] };
  }

  const [weavy, gemini, flow, vids, roboneo, galleri5, kie, runninghub] = await Promise.all([
    getProviderAccountsFromSheet(cleanUserId, 'weavy'),
    getProviderAccountsFromSheet(cleanUserId, 'gemini'),
    getProviderAccountsFromSheet(cleanUserId, 'flow'),
    getProviderAccountsFromSheet(cleanUserId, 'vids'),
    getProviderAccountsFromSheet(cleanUserId, 'roboneo'),
    getProviderAccountsFromSheet(cleanUserId, 'galleri5'),
    getProviderAccountsFromSheet(cleanUserId, 'kie'),
    getProviderAccountsFromSheet(cleanUserId, 'runninghub'),
  ]);

  return {
    weavy,
    gemini,
    flow,
    vids,
    roboneo,
    galleri5,
    kie,
    runninghub,
  };
}
