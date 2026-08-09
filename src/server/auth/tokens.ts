import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { requireEnv } from '@/server/env';

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export class TokenExpiredError extends Error {}
export class InvalidTokenError extends Error {}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(requireEnv('JWT_SECRET'));
}

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<{ userId: string }> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.userId !== 'string' || !payload.userId) {
      throw new InvalidTokenError('Token payload missing userId');
    }
    return { userId: payload.userId };
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
