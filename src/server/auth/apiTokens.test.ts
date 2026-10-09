import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { repository, loggerMock } = vi.hoisted(() => ({
  repository: { findByHash: vi.fn(), markUsed: vi.fn() },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/server/repositories/apiTokenRepository', () => ({
  apiTokenRepository: repository,
}));
vi.mock('@/server/logging/logger', () => ({ default: loggerMock }));

import { authenticateApiToken } from '@/server/auth/apiTokens';
import { mintApiToken } from '@/server/auth/apiTokenFormat';
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

let token: string;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
  token = mintApiToken();
});

describe('authenticateApiToken', () => {
  it('looks the token up by its SHA-256 and returns its owner', async () => {
    repository.findByHash.mockResolvedValue(storedToken());

    const identity = await authenticateApiToken(token, 'IMPORTS');

    expect(identity).toEqual({ userId: USER_ID, apiTokenId: 'token-id' });
    expect(repository.findByHash).toHaveBeenCalledWith(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(repository.markUsed).toHaveBeenCalledWith(
      'token-id',
      expect.any(Date),
    );
  });

  it('refuses a forged token without a database lookup', async () => {
    const forged = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;

    await expect(authenticateApiToken(forged, 'IMPORTS')).rejects.toMatchObject(
      { code: 'INVALID_API_TOKEN' },
    );
    await expect(
      authenticateApiToken('mxk_garbage', 'IMPORTS'),
    ).rejects.toMatchObject({ code: 'INVALID_API_TOKEN' });
    expect(repository.findByHash).not.toHaveBeenCalled();
  });

  it('refuses a token without the route scope, with a 403', async () => {
    repository.findByHash.mockResolvedValue(storedToken({ scopes: [] }));

    const authentication = authenticateApiToken(token, 'IMPORTS');

    await expect(authentication).rejects.toBeInstanceOf(HttpError);
    await expect(authentication).rejects.toMatchObject({ status: 403 });
    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it('skips the last-used write when the token was used within the hour', async () => {
    repository.findByHash.mockResolvedValue(
      storedToken({ lastUsedAt: new Date(Date.now() - HOUR_MS / 2) }),
    );

    await authenticateApiToken(token, 'IMPORTS');

    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it('rewrites last use once it is an hour old', async () => {
    repository.findByHash.mockResolvedValue(
      storedToken({ lastUsedAt: new Date(Date.now() - HOUR_MS) }),
    );

    await authenticateApiToken(token, 'IMPORTS');

    expect(repository.markUsed).toHaveBeenCalled();
  });

  it('rejects an unknown token', async () => {
    repository.findByHash.mockResolvedValue(null);

    await expect(authenticateApiToken(token, 'IMPORTS')).rejects.toMatchObject({
      code: 'INVALID_API_TOKEN',
    });
  });

  it('rejects an expired token without recording a use', async () => {
    repository.findByHash.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - 1) }),
    );

    await expect(authenticateApiToken(token, 'IMPORTS')).rejects.toMatchObject({
      code: 'API_TOKEN_EXPIRED',
    });
    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it('still authenticates when recording the use fails', async () => {
    repository.findByHash.mockResolvedValue(storedToken());
    repository.markUsed.mockRejectedValue(new Error('db down'));

    await expect(authenticateApiToken(token, 'IMPORTS')).resolves.toEqual({
      userId: USER_ID,
      apiTokenId: 'token-id',
    });
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});
