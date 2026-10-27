import type { NextRequest } from 'next/server';
import { deleteValue, getValue, setValue } from '@/server/redis';
import { InvalidTokenError, TokenExpiredError, verifyToken } from '@/server/auth/tokens';
import { SESSION_COOKIE } from '@/server/auth/cookies';

export class AuthError extends Error {
  public constructor(
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
  await setValue(sessionKey(userId, token), '1', ttlSeconds, 'branch');
}

export async function invalidateSession(userId: string, token: string): Promise<void> {
  await deleteValue(sessionKey(userId, token), 'branch');
}

async function isSessionActive(userId: string, token: string): Promise<boolean> {
  return (await getValue(sessionKey(userId, token), 'branch')) !== null;
}

export type Credential = { source: 'cookie' | 'bearer'; token: string };

export function extractBearerToken(request: NextRequest): string | null {
  const [scheme, token] = request.headers.get('authorization')?.split(' ') ?? [];
  const isBearer = scheme?.toLowerCase() === 'bearer' && !!token;
  return isBearer ? token : null;
}

export function extractCredential(request: NextRequest): Credential | null {
  const cookieToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookieToken) {
    return { source: 'cookie', token: cookieToken };
  }
  const bearerToken = extractBearerToken(request);
  return bearerToken ? { source: 'bearer', token: bearerToken } : null;
}

export function extractToken(request: NextRequest): string | null {
  return extractCredential(request)?.token ?? null;
}

export async function requireUser(request: NextRequest): Promise<string> {
  const token = extractToken(request);
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
