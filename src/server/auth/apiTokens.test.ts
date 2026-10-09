import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { repository, loggerMock } = vi.hoisted(() => ({
  repository: { findByHash: vi.fn(), markUsed: vi.fn() },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/server/repositories/apiTokenRepository', () => ({
  apiTokenRepository: repository,
}));
vi.mock('@/server/logging/logger', () => ({ default: loggerMock }));

import { authenticateApiToken, bearerApiToken } from '@/server/auth/apiTokens';
import { AuthError } from '@/server/auth/session';
import { HttpError } from '@/server/http/errors';
import type { ApiTokenScope } from '@/shared/types/apiToken';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const HOUR_MS = 60 * 60 * 1000;

function storedToken(
  overrides: {
    expiresAt?: Date;
    lastUsedAt?: Date | null;
    scopes?: ApiTokenScope[];
  } = {},
) {
  return {
    id: 'token-id',
    userId: USER_ID,
    scopes: overrides.scopes ?? ['IMPORTS'],
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 24 * HOUR_MS),
    lastUsedAt: overrides.lastUsedAt ?? null,
  };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected a rejection');
    },
    (err: unknown) => err,
  );
}

async function authError(promise: Promise<unknown>): Promise<AuthError> {
  const error = await rejection(promise);
  if (!(error instanceof AuthError)) {
    throw new Error(`Expected an AuthError, got ${String(error)}`);
  }
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authenticateApiToken', () => {
  it('looks the token up by its SHA-256 and returns its owner', async () => {
    repository.findByHash.mockResolvedValue(storedToken());

    const userId = await authenticateApiToken('mxk_secret', 'IMPORTS');

    expect(userId).toBe(USER_ID);
    expect(repository.findByHash).toHaveBeenCalledWith(
      createHash('sha256').update('mxk_secret').digest('hex'),
    );
    expect(repository.markUsed).toHaveBeenCalledWith(
      'token-id',
      expect.any(Date),
    );
  });

  it('refuses a token without the route scope, with a 403', async () => {
    repository.findByHash.mockResolvedValue(storedToken({ scopes: [] }));

    const error = await rejection(
      authenticateApiToken('mxk_secret', 'IMPORTS'),
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 403 });
    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it('skips the last-used write when the token was used within the hour', async () => {
    repository.findByHash.mockResolvedValue(
      storedToken({ lastUsedAt: new Date(Date.now() - HOUR_MS / 2) }),
    );

    await authenticateApiToken('mxk_secret', 'IMPORTS');

    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it('rewrites last use once it is an hour old', async () => {
    repository.findByHash.mockResolvedValue(
      storedToken({ lastUsedAt: new Date(Date.now() - HOUR_MS) }),
    );

    await authenticateApiToken('mxk_secret', 'IMPORTS');

    expect(repository.markUsed).toHaveBeenCalled();
  });

  it('rejects an unknown token', async () => {
    repository.findByHash.mockResolvedValue(null);

    const error = await authError(authenticateApiToken('mxk_nope', 'IMPORTS'));

    expect(error.code).toBe('INVALID_API_TOKEN');
  });

  it('rejects an expired token without recording a use', async () => {
    repository.findByHash.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - 1) }),
    );

    const error = await authError(authenticateApiToken('mxk_old', 'IMPORTS'));

    expect(error.code).toBe('API_TOKEN_EXPIRED');
    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it('still authenticates when recording the use fails', async () => {
    repository.findByHash.mockResolvedValue(storedToken());
    repository.markUsed.mockRejectedValue(new Error('db down'));

    await expect(authenticateApiToken('mxk_secret', 'IMPORTS')).resolves.toBe(
      USER_ID,
    );
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});

describe('bearerApiToken', () => {
  function request(authorization?: string): NextRequest {
    return new NextRequest('http://localhost/api/imports', {
      headers: authorization ? { authorization } : {},
    });
  }

  it('returns a prefixed bearer', () => {
    expect(bearerApiToken(request('Bearer mxk_abc'))).toBe('mxk_abc');
  });

  it('ignores a session JWT bearer and a missing header', () => {
    expect(bearerApiToken(request('Bearer eyJhbGciOi'))).toBeNull();
    expect(bearerApiToken(request())).toBeNull();
  });
});
