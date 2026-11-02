import { extensionBridge, ImportedWeavyAccount } from './extensionBridge';
import { verifyWeavyAccount } from './weavyApi';

export interface WeavyAccountInfo {
  email: string;
  name: string;
  idToken: string;
  refreshToken: string;
  credits: number;
  totalCredits: number;
  expiresInSeconds: number;
  cookie?: string;
}

export async function autoImportWeavyAccountForEmail(email: string): Promise<ImportedWeavyAccount> {
  const expectedEmail = email.trim().toLowerCase();
  if (!expectedEmail) throw new Error('Email akun Weavy wajib ada untuk verifikasi Auto-Import.');

  const result = await extensionBridge.autoImportActiveAccount('weavy');
  if (!result.success || !result.account) {
    throw new Error(result.error || 'Gagal mengambil sesi Weavy dari ekstensi.');
  }

  if (result.account.email.trim().toLowerCase() !== expectedEmail) {
    throw new Error(
      `Sesi Weavy aktif (${result.account.email || 'email tidak diketahui'}) berbeda dari akun yang diminta (${email}).`
    );
  }

  return result.account;
}

/**
 * Menukar Refresh Token menjadi ID Token (Access Token) & mengambil profil + credits.
 * Urutan: Firebase Auth langsung (tidak kena WAF) -> baca kredit via Extension Bridge.
 * Server hanya dipakai sebagai fallback terakhir.
 */
async function exchangeRefreshTokenDirect(
  refreshTokenInput: string
): Promise<WeavyAccountInfo> {
  const cleanRefreshToken = refreshTokenInput.trim();

  if (!cleanRefreshToken) {
    throw new Error('Refresh token tidak boleh kosong.');
  }

  const verification = await verifyWeavyAccount(cleanRefreshToken);
  if (verification.success && verification.idToken) {
    return {
      email: verification.email || 'user@weavy.ai',
      name: verification.name || 'Weavy User',
      idToken: verification.idToken,
      refreshToken: verification.refreshToken || cleanRefreshToken,
      credits: verification.credits,
      totalCredits: verification.totalCredits || 150,
      expiresInSeconds: verification.expiresInSeconds || 3600,
    };
  }

  throw new Error(verification.error || 'Gagal memverifikasi akun Weavy.');
}

export async function exchangeRefreshTokenAndGetInfo(
  refreshTokenInput: string,
  expectedEmail?: string,
): Promise<WeavyAccountInfo> {
  try {
    return await exchangeRefreshTokenDirect(refreshTokenInput);
  } catch (refreshError) {
    if (!expectedEmail?.trim()) throw refreshError;

    try {
      const imported = await autoImportWeavyAccountForEmail(expectedEmail);
      return {
        email: imported.email,
        name: imported.name,
        idToken: imported.idToken || '',
        refreshToken: imported.refreshToken,
        credits: imported.credits,
        totalCredits: imported.totalCredits || 150,
        expiresInSeconds: 3600,
        cookie: imported.cookie,
      };
    } catch (importError) {
      const refreshMessage = refreshError instanceof Error ? refreshError.message : String(refreshError);
      const importMessage = importError instanceof Error ? importError.message : String(importError);
      throw new Error(
        `Refresh token Weavy gagal: ${refreshMessage}. Auto-Import background juga gagal: ${importMessage}`,
      );
    }
  }
}
