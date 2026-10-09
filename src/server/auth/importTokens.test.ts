import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { repository, loggerMock } = vi.hoisted(() => ({
  repository: { findByHash: vi.fn(), markUsed: vi.fn() },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/server/repositories/importTokenRepository', () => ({
  importTokenRepository: repository,
}));
vi.mock('@/server/logging/logger', () => ({ default: loggerMock }));

import {
  authenticateImportToken,
  bearerImportToken,
} from '@/server/auth/importTokens';
import { AuthError } from '@/server/auth/session';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const HOUR_MS = 60 * 60 * 1000;

function storedToken(
  overrides: { expiresAt?: Date; lastUsedAt?: Date | null } = {},
) {
  return {
    id: 'token-id',
    userId: USER_ID,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 24 * HOUR_MS),
    lastUsedAt: overrides.lastUsedAt ?? null,
  };
}

async function authError(promise: Promise<unknown>): Promise<AuthError> {
  const error = await promise.catch((err: unknown) => err);
  if (!(error instanceof AuthError)) {
    throw new Error(`Expected an AuthError, got ${String(error)}`);
  }
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authenticateImportToken', () => {
  it('looks the token up by its SHA-256 and returns its owner', async () => {
    repository.findByHash.mockResolvedValue(storedToken());

    const userId = await authenticateImportToken('mxi_secret');

    expect(userId).toBe(USER_ID);
    expect(repository.findByHash).toHaveBeenCalledWith(
      createHash('sha256').update('mxi_secret').digest('hex'),
    );
    expect(repository.markUsed).toHaveBeenCalledWith(
      'token-id',
      expect.any(Date),
    );
  });

  it('skips the last-used write when the token was used within the hour', async () => {
    repository.findByHash.mockResolvedValue(
      storedToken({ lastUsedAt: new Date(Date.now() - HOUR_MS / 2) }),
    );

    await authenticateImportToken('mxi_secret');

    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it('rewrites last use once it is an hour old', async () => {
    repository.findByHash.mockResolvedValue(
      storedToken({ lastUsedAt: new Date(Date.now() - HOUR_MS) }),
    );

    await authenticateImportToken('mxi_secret');

    expect(repository.markUsed).toHaveBeenCalled();
  });

  it('rejects an unknown token', async () => {
    repository.findByHash.mockResolvedValue(null);

    const error = await authError(authenticateImportToken('mxi_nope'));

    expect(error.code).toBe('INVALID_IMPORT_TOKEN');
  });

  it('rejects an expired token without recording a use', async () => {
    repository.findByHash.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - 1) }),
    );

    const error = await authError(authenticateImportToken('mxi_old'));

    expect(error.code).toBe('IMPORT_TOKEN_EXPIRED');
    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it('still authenticates when recording the use fails', async () => {
    repository.findByHash.mockResolvedValue(storedToken());
    repository.markUsed.mockRejectedValue(new Error('db down'));

    await expect(authenticateImportToken('mxi_secret')).resolves.toBe(USER_ID);
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});

describe('bearerImportToken', () => {
  function request(authorization?: string): NextRequest {
    return new NextRequest('http://localhost/api/imports', {
      headers: authorization ? { authorization } : {},
    });
  }

  it('returns a prefixed bearer', () => {
    expect(bearerImportToken(request('Bearer mxi_abc'))).toBe('mxi_abc');
  });

  it('ignores a session JWT bearer and a missing header', () => {
    expect(bearerImportToken(request('Bearer eyJhbGciOi'))).toBeNull();
    expect(bearerImportToken(request())).toBeNull();
  });
});
