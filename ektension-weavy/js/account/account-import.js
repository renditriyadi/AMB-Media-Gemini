import { parseJwt } from '../core/utils.js';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
const FIREBASE_REFRESH_TOKEN_REGEX = /\b(AMf-[a-zA-Z0-9_-]{20,})\b/;
const JWT_TOKEN_REGEX = /\b(eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,})\b/;

/**
 * Parses raw JSON string into an array of normalized account objects.
 * Handles arrays, single objects, wrappers ({ accounts: [...] }, { data: [...] }),
 * or dictionary objects ({ uid: { ... } }).
 */
export function parseAccountsFromJson(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return [];

  let parsed;
  try {
    parsed = JSON.parse(rawInput.trim());
  } catch (_) {
    return [];
  }

  let rawList = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.accounts)) {
      rawList = parsed.accounts;
    } else if (Array.isArray(parsed.data)) {
      rawList = parsed.data;
    } else if (Array.isArray(parsed.items)) {
      rawList = parsed.items;
    } else if (parsed.account && typeof parsed.account === 'object') {
      rawList = [parsed.account];
    } else {
      // Check if it's a dictionary of accounts (e.g. { "user1": { email, ... }, "user2": { ... } })
      const values = Object.values(parsed);
      const isDictOfAccounts = values.length > 0 && values.every(v => v && typeof v === 'object' && !Array.isArray(v) && (v.email || v.refreshToken || v.token || v.stsTokenManager || v.idToken));
      if (isDictOfAccounts) {
        rawList = values;
      } else {
        rawList = [parsed];
      }
    }
  }

  const results = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;

    let email = item.email || item.mail || item.userEmail || item.user_email || item.username || item.accountEmail || '';
    const refreshToken = item.refreshToken || item.refresh_token || item.refreshtoken || item.token || item.stsTokenManager?.refreshToken || item.stsTokenManager?.refresh_token || item.sts_token_manager?.refreshToken || '';
    const idToken = item.idToken || item.id_token || item.idtoken || item.accessToken || item.access_token || item.stsTokenManager?.accessToken || '';
    const cookie = item.cookie || item.cookies || '';
    let name = item.name || item.displayName || item.display_name || item.nick || '';
    const provider = item.provider === 'flow' ? 'flow' : (item.provider === 'dola' || item.sessionid ? 'dola' : (item.provider === 'gemini' ? 'gemini' : 'weavy'));
    const credits = typeof item.credits === 'number' ? item.credits : (typeof item.credit === 'number' ? item.credit : 100);
    const userId = item.userId || item.user_id || item.uid || item.id || '';
    const chromeProfile = item.chromeProfile || item.profile || item.profileName || '';
    const sessionid = item.sessionid || '';

    // If email is missing but idToken is a valid JWT, decode it
    if (!email && idToken && idToken.startsWith('eyJ')) {
      const decoded = parseJwt(idToken);
      if (decoded?.email) email = decoded.email;
      if (!name && decoded?.name) name = decoded.name;
    }

    if (!name && email) {
      name = email.split('@')[0];
    }

    // Filter valid accounts per provider
    const isWeavyValid = (provider === 'weavy' || !item.provider) && (refreshToken || idToken);
    const isFlowValid = provider === 'flow' && (email || cookie);
    const isDolaValid = provider === 'dola' && (email || cookie || sessionid);
    const isGeminiValid = provider === 'gemini' && (email || cookie || item.apiKey);

    if (isWeavyValid || isFlowValid || isDolaValid || isGeminiValid) {
      results.push({
        email: email.trim(),
        name: name.trim(),
        refreshToken: refreshToken.trim(),
        idToken: idToken.trim(),
        cookie: cookie.trim(),
        provider,
        credits,
        userId: String(userId || '').trim(),
        chromeProfile: chromeProfile.trim(),
        sessionid: sessionid.trim(),
      });
    }
  }

  return results;
}

/**
 * Parses plain text / TXT / delimiter data into normalized account objects.
 * Supports:
 * - Key-value blocks (Email: ..., Refresh Token: ...)
 * - Delimited lines (email|token, email:token, email:pass:token, email----pass----token)
 * - Raw token lists (AMf-... per line)
 * - Alternating email and token lines
 */
export function parseAccountsFromTxt(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return [];
  const text = rawInput.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return [];

  const results = [];
  const seenTokens = new Set();
  const seenEmails = new Set();

  const addAccountIfValid = (acc) => {
    if (!acc) return false;
    const token = (acc.refreshToken || acc.idToken || '').trim();
    const email = (acc.email || '').trim();

    // Must have at least a token OR a valid email for non-weavy
    if (!token && !email) return false;

    // Deduplicate by token if token exists, or by email
    const dedupKey = token || email.toLowerCase();
    if (seenTokens.has(dedupKey)) return false;
    seenTokens.add(dedupKey);

    let name = acc.name || '';
    if (!name && email) {
      name = email.split('@')[0];
    } else if (!name && token) {
      name = `Akun ${results.length + 1}`;
    }

    results.push({
      email,
      name,
      refreshToken: token,
      idToken: acc.idToken || '',
      cookie: acc.cookie || '',
      provider: acc.provider || 'weavy',
      credits: acc.credits ?? 100,
      userId: acc.userId || '',
      chromeProfile: acc.chromeProfile || '',
      sessionid: acc.sessionid || '',
    });
    return true;
  };

  // Strategy 1: Check for labeled blocks or structured lines (Email: ... \n Refresh Token: ...)
  // Split text by lines and parse sequentially with a stateful accumulator
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let currentBlock = { email: '', refreshToken: '', name: '', cookie: '', idToken: '' };
  let hasBlockTokens = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for explicit key-value labels
    const emailLabelMatch = line.match(/^(?:email|mail|user(?:name)?|akun|account)\s*[:=]\s*(\S+@\S+\.\S+)/i);
    const tokenLabelMatch = line.match(/^(?:refresh[_\s-]*token|refreshtoken|token|auth[_\s-]*token)\s*[:=]\s*(\S+)/i);
    const cookieLabelMatch = line.match(/^(?:cookie|cookies)\s*[:=]\s*(.+)/i);
    const nameLabelMatch = line.match(/^(?:nama|name|display[_\s-]*name)\s*[:=]\s*(.+)/i);

    if (emailLabelMatch || tokenLabelMatch || cookieLabelMatch || nameLabelMatch) {
      hasBlockTokens = true;

      if (emailLabelMatch) {
        // If currentBlock already has an email OR has a token waiting, commit previous block and start fresh
        if (currentBlock.email || currentBlock.refreshToken || currentBlock.idToken) {
          addAccountIfValid(currentBlock);
          currentBlock = { email: '', refreshToken: '', name: '', cookie: '', idToken: '' };
        }
        currentBlock.email = emailLabelMatch[1].trim();
        if (!currentBlock.name) currentBlock.name = currentBlock.email.split('@')[0];
      }

      if (tokenLabelMatch) {
        // If currentBlock already has a token, commit previous block before setting new token
        if (currentBlock.refreshToken || currentBlock.idToken) {
          addAccountIfValid(currentBlock);
          currentBlock = { email: '', refreshToken: '', name: '', cookie: '', idToken: '' };
        }

        const rawToken = tokenLabelMatch[1].trim();
        if (rawToken.startsWith('eyJ')) {
          currentBlock.idToken = rawToken;
          currentBlock.refreshToken = rawToken;
          // Decode JWT if email missing
          if (!currentBlock.email) {
            const decoded = parseJwt(rawToken);
            if (decoded?.email) currentBlock.email = decoded.email;
          }
        } else {
          currentBlock.refreshToken = rawToken;
        }

        // If block has both email and token, commit it immediately
        if (currentBlock.email) {
          addAccountIfValid(currentBlock);
          currentBlock = { email: '', refreshToken: '', name: '', cookie: '', idToken: '' };
        }
      }

      if (cookieLabelMatch) {
        currentBlock.cookie = cookieLabelMatch[1].trim();
      }

      if (nameLabelMatch) {
        currentBlock.name = nameLabelMatch[1].trim();
      }

      continue;
    }

    // Strategy 2: Delimited lines (email|token, email:token, email:pass:token, etc.)
    // Check if line contains an email
    const emailMatch = line.match(EMAIL_REGEX);
    const firebaseTokenMatch = line.match(FIREBASE_REFRESH_TOKEN_REGEX);
    const jwtTokenMatch = line.match(JWT_TOKEN_REGEX);

    if (emailMatch) {
      const email = emailMatch[0].trim();
      let extractedToken = '';

      if (firebaseTokenMatch) {
        extractedToken = firebaseTokenMatch[1].trim();
      } else if (jwtTokenMatch) {
        extractedToken = jwtTokenMatch[1].trim();
      } else {
        // Try delimiter split: |, :, ;, tab, or ----
        const parts = line.split(/[|\t;,]|:{1,4}|-{3,}/).map((s) => s.trim()).filter(Boolean);
        for (const part of parts) {
          if (part.toLowerCase() === email.toLowerCase()) continue;
          // Token candidate: long alphanumeric string (length >= 25) without whitespace
          if (part.length >= 25 && !/\s/.test(part) && !part.includes('@')) {
            extractedToken = part;
            break;
          }
        }
      }

      if (extractedToken) {
        // Delimited line with both email and token found!
        if (currentBlock.refreshToken || currentBlock.email) {
          addAccountIfValid(currentBlock);
          currentBlock = { email: '', refreshToken: '', name: '', cookie: '', idToken: '' };
        }
        addAccountIfValid({
          email,
          name: email.split('@')[0],
          refreshToken: extractedToken,
          idToken: extractedToken.startsWith('eyJ') ? extractedToken : '',
        });
        continue;
      } else {
        // Line has only email. Check next line if it is a token (alternating format)
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const nextFirebaseToken = nextLine.match(FIREBASE_REFRESH_TOKEN_REGEX);
          const nextJwt = nextLine.match(JWT_TOKEN_REGEX);
          const isNextToken = nextFirebaseToken || nextJwt || (nextLine.length >= 30 && !nextLine.includes('@') && !/\s/.test(nextLine));

          if (isNextToken) {
            const tokenVal = nextFirebaseToken ? nextFirebaseToken[1] : (nextJwt ? nextJwt[1] : nextLine);
            addAccountIfValid({
              email,
              name: email.split('@')[0],
              refreshToken: tokenVal,
              idToken: tokenVal.startsWith('eyJ') ? tokenVal : '',
            });
            i++; // skip next line since consumed
            continue;
          }
        }

        // Otherwise set into currentBlock
        if (currentBlock.refreshToken) {
          currentBlock.email = email;
          addAccountIfValid(currentBlock);
          currentBlock = { email: '', refreshToken: '', name: '', cookie: '', idToken: '' };
        } else {
          currentBlock.email = email;
        }
        continue;
      }
    }

    // Strategy 3: Standalone token on line
    if (firebaseTokenMatch) {
      const token = firebaseTokenMatch[1].trim();
      if (currentBlock.email) {
        currentBlock.refreshToken = token;
        addAccountIfValid(currentBlock);
        currentBlock = { email: '', refreshToken: '', name: '', cookie: '', idToken: '' };
      } else {
        addAccountIfValid({ refreshToken: token });
      }
      continue;
    }

    if (jwtTokenMatch) {
      const token = jwtTokenMatch[1].trim();
      const decoded = parseJwt(token);
      const email = decoded?.email || currentBlock.email || '';
      const name = decoded?.name || (email ? email.split('@')[0] : '');
      addAccountIfValid({
        email,
        name,
        refreshToken: token,
        idToken: token,
      });
      if (currentBlock.email === email) {
        currentBlock = { email: '', refreshToken: '', name: '', cookie: '', idToken: '' };
      }
      continue;
    }

    // Strategy 4: Raw long token string (length >= 30, no spaces, no delimiters)
    if (line.length >= 30 && !/\s/.test(line) && !line.includes(':') && !line.includes('|')) {
      if (currentBlock.email) {
        currentBlock.refreshToken = line;
        addAccountIfValid(currentBlock);
        currentBlock = { email: '', refreshToken: '', name: '', cookie: '', idToken: '' };
      } else {
        addAccountIfValid({ refreshToken: line });
      }
      continue;
    }
  }

  // Commit any leftover block
  if (currentBlock.refreshToken || currentBlock.idToken || currentBlock.email) {
    addAccountIfValid(currentBlock);
  }

  return results;
}

/**
 * Universal account importer parser.
 * Automatically tries JSON first if formatted with { or [,
 * and seamlessly falls back to TXT/delimiter parser.
 */
export function parseImportAccounts(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return [];
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  // 1. Try JSON if it starts with { or [
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const jsonResults = parseAccountsFromJson(trimmed);
      if (jsonResults && jsonResults.length > 0) {
        return jsonResults;
      }
    } catch (_) {
      // ignore and try txt
    }
  }

  // 2. Parse as text / lines / delimiter
  const txtResults = parseAccountsFromTxt(trimmed);
  if (txtResults && txtResults.length > 0) {
    return txtResults;
  }

  // 3. Fallback try JSON even if leading chars exist
  try {
    const jsonMatch = trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      const fallbackJson = parseAccountsFromJson(jsonMatch[0]);
      if (fallbackJson && fallbackJson.length > 0) {
        return fallbackJson;
      }
    }
  } catch (_) {}

  return [];
}

/**
 * Counts valid accounts detected in the input data.
 */
export function countImportAccounts(rawInput, _isTxt = null) {
  return parseImportAccounts(rawInput).length;
}

/**
 * Backwards-compatible helper: extracts refresh token strings.
 */
export function parseRefreshTokensFromTxt(rawInput) {
  const accounts = parseImportAccounts(rawInput);
  return [...new Set(accounts.map((a) => a.refreshToken).filter(Boolean))];
}
