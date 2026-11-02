import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const AES_KEY = crypto.pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1');
const AES_IV = Buffer.alloc(16, 0x20); // 16 spaces for Linux Chromium

const profileCookiesMemoryCache = new Map<string, { cookies: string; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function clearGeminiProfileCookiesCache(email: string): void {
  if (!email || !email.includes('@')) return;
  profileCookiesMemoryCache.delete(email.trim().toLowerCase());
}

/**
 * Resolves the Playwright profile directory for a given Google email.
 */
export function getProfileDirForEmail(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const cleanEmail = email.trim().toLowerCase();
  const profileId = crypto.createHash('sha256').update(cleanEmail).digest('hex');
  const baseDir = path.join(process.cwd(), '.playwright-profiles');
  const directPath = path.join(baseDir, profileId);

  if (fs.existsSync(directPath)) {
    return directPath;
  }

  // Fallback: search all directories in .playwright-profiles if sha256 differed
  if (fs.existsSync(baseDir)) {
    try {
      const dirs = fs.readdirSync(baseDir);
      for (const d of dirs) {
        const fullDir = path.join(baseDir, d);
        const prefPath = path.join(fullDir, 'Default', 'Preferences');
        if (fs.existsSync(prefPath)) {
          const prefData = fs.readFileSync(prefPath, 'utf8');
          if (prefData.toLowerCase().includes(cleanEmail)) {
            return fullDir;
          }
        }
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Extracts and decrypts cookies for a Google Gemini account by email.
 */
export function getCookiesForGeminiEmail(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const cleanEmail = email.trim().toLowerCase();

  // 1. Check memory cache
  const cached = profileCookiesMemoryCache.get(cleanEmail);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && cached.cookies) {
    return cached.cookies;
  }

  const profileDir = getProfileDirForEmail(cleanEmail);
  if (!profileDir) return null;

  // 2. Check cached cookies.txt file inside profile
  const cachedFile = path.join(profileDir, 'cookies.txt');
  if (fs.existsSync(cachedFile)) {
    try {
      const content = fs.readFileSync(cachedFile, 'utf8').trim();
      if (content && (content.includes('__Secure-1PSID') || content.includes('SID='))) {
        profileCookiesMemoryCache.set(cleanEmail, { cookies: content, timestamp: Date.now() });
        return content;
      }
    } catch (e) {}
  }

  // 3. Extract and decrypt cookies from SQLite DB
  const cookieDbPath = path.join(profileDir, 'Default', 'Cookies');
  if (!fs.existsSync(cookieDbPath)) return null;

  const pythonScript = path.join(process.cwd(), 'server', 'utils', 'dump_profile_cookies.py');
  if (!fs.existsSync(pythonScript)) return null;

  try {
    const rawJson = execFileSync('python3', [pythonScript, cookieDbPath], {
      encoding: 'utf8',
      timeout: 10000,
    });
    const rows: Array<{ name: string; val: string; hex: string }> = JSON.parse(rawJson);
    const cookies: string[] = [];

    for (const r of rows) {
      if (r.val) {
        cookies.push(`${r.name}=${r.val}`);
      } else if (r.hex && r.hex.startsWith('763130')) {
        // v10 encrypted cookie
        const encBuf = Buffer.from(r.hex.slice(6), 'hex');
        try {
          const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, AES_IV);
          const dec = Buffer.concat([decipher.update(encBuf), decipher.final()]);
          const str = dec.toString('utf8').replace(/[^\x20-\x7E]/g, '');
          if (str) {
            cookies.push(`${r.name}=${str}`);
          }
        } catch (e) {}
      }
    }

    const cookieString = cookies.join('; ');
    if (cookieString) {
      try {
        fs.writeFileSync(cachedFile, cookieString, 'utf8');
      } catch (e) {}
      profileCookiesMemoryCache.set(cleanEmail, { cookies: cookieString, timestamp: Date.now() });
      return cookieString;
    }
  } catch (err: any) {
    console.warn(`[getCookiesForGeminiEmail error for ${cleanEmail}]:`, err.message);
  }

  return null;
}
