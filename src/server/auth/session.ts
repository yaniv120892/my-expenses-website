import { NextRequest } from 'next/server';
import { deleteValue, getValue, setValue } from '@/server/redis';
import {
  InvalidTokenError,
  TokenExpiredError,
  verifyToken,
} from '@/server/auth/tokens';

export const SESSION_COOKIE = 'session';

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function sessionKey(userId: string, token: string): string {
  return `session:${userId}:${token}`;
}

export async function storeSession(
  userId: string,
  token: string,
  ttlSeconds: number,
): Promise<void> {
  await setValue(sessionKey(userId, token), '1', ttlSeconds);
}

export async function invalidateSession(
  userId: string,
  token: string,
): Promise<void> {
  await deleteValue(sessionKey(userId, token));
}

export async function isSessionActive(
  userId: string,
  token: string,
): Promise<boolean> {
  return (await getValue(sessionKey(userId, token))) !== null;
}

export function extractToken(req: NextRequest): string | null {
  const cookieToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookieToken) {
    return cookieToken;
  }
  // Bearer fallback keeps the API usable by scripts and the e2e harness.
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return null;
  }
  return authHeader.split(' ')[1] ?? null;
}

export async function requireUser(req: NextRequest): Promise<string> {
  const token = extractToken(req);
  if (!token) {
    throw new AuthError('AUTH_REQUIRED', 'Authentication required');
  }

  let userId: string;
  try {
    ({ userId } = await verifyToken(token));
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      throw new AuthError('TOKEN_EXPIRED', 'Token expired');
    }
    if (err instanceof InvalidTokenError) {
      throw new AuthError('INVALID_TOKEN', 'Invalid token');
    }
    throw err;
  }

  if (!(await isSessionActive(userId, token))) {
    throw new AuthError('SESSION_EXPIRED', 'Session expired');
  }
  return userId;
}
