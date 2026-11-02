import crypto from 'crypto';

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const sessionSecret = crypto.randomBytes(32);

export interface AuthenticatedUser {
  userId: string;
  userName: string;
}

interface UserSessionPayload extends AuthenticatedUser {
  expiresAt: number;
}

export function createUserSessionToken(user: AuthenticatedUser): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload: UserSessionPayload = {
    userId: user.userId,
    userName: user.userName,
    expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(encodedPayload).digest('base64url');
  return { token: `${encodedPayload}.${signature}`, expiresAt };
}

export function verifyUserSessionToken(token: string): AuthenticatedUser | null {
  const [encodedPayload, providedSignature, extra] = token.split('.');
  if (!encodedPayload || !providedSignature || extra !== undefined) return null;

  const expectedSignature = crypto.createHmac('sha256', sessionSecret).update(encodedPayload).digest();
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(providedSignature, 'base64url');
  } catch {
    return null;
  }
  if (actualSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(actualSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<UserSessionPayload>;
    if (
      typeof payload.userId !== 'string' ||
      !payload.userId ||
      typeof payload.userName !== 'string' ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return { userId: payload.userId, userName: payload.userName };
  } catch {
    return null;
  }
}
