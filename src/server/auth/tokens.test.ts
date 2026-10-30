import { beforeEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { signToken, verifyToken } from '@/server/auth/tokens';

const USER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  process.env.JWT_SECRET = 'tokens-test-secret';
});

describe('session tokens', () => {
  it('carry the token version they were signed at', async () => {
    const token = await signToken({ userId: USER_ID, tokenVersion: 4 });

    expect(await verifyToken(token)).toEqual({ userId: USER_ID, tokenVersion: 4 });
  });

  it('read a session signed before versions existed as version 0', async () => {
    const legacyToken = await new SignJWT({ userId: USER_ID })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('tokens-test-secret'));

    expect(await verifyToken(legacyToken)).toEqual({ userId: USER_ID, tokenVersion: 0 });
  });
});
