import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { requireEnv } from '@/server/env';
import type { SessionClaims } from '@/server/auth/tokens.types';

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export class TokenExpiredError extends Error {}
export class InvalidTokenError extends Error {}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(requireEnv('JWT_SECRET'));
}

export async function signToken({ userId, tokenVersion }: SessionClaims): Promise<string> {
  // The random id keeps two tokens signed for one user in the same second
  // distinct, so ending every session never spares a token reissued after it.
  return new SignJWT({ userId, tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

// A session signed before token versions existed is version 0, which every
// account started at.
export async function verifyToken(token: string): Promise<SessionClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.userId !== 'string' || !payload.userId) {
      throw new InvalidTokenError('Token payload missing userId');
    }
    const tokenVersion = typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 0;
    return { userId: payload.userId, tokenVersion };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new TokenExpiredError('Token expired');
    }
    if (err instanceof InvalidTokenError) {
      throw err;
    }
    throw new InvalidTokenError('Invalid token');
  }
}

export function tokenTtlSeconds(): number {
  return TOKEN_TTL_SECONDS;
}
