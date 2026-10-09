import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { repository, loggerMock } = vi.hoisted(() => ({
  repository: {
    create: vi.fn(),
    findByUserId: vi.fn(),
    findByHash: vi.fn(),
    markUsed: vi.fn(),
    delete: vi.fn(),
  },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/server/repositories/importTokenRepository', () => ({
  importTokenRepository: repository,
}));
vi.mock('@/server/logging/logger', () => ({ default: loggerMock }));

import {
  IMPORT_TOKEN_PREFIX,
  bearerImportToken,
  importTokenService,
} from '@/server/auth/importTokens';
import { AuthError } from '@/server/auth/session';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const DAY_MS = 24 * 60 * 60 * 1000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function storedToken(overrides: { expiresAt?: Date } = {}) {
  return {
    id: 'token-id',
    userId: USER_ID,
    name: 'script',
    tokenHash: 'hash',
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + DAY_MS),
    lastUsedAt: null,
    createdAt: new Date(),
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

describe('importTokenService.create', () => {
  it('returns a prefixed token and stores only its hash', async () => {
    repository.create.mockImplementation(async (data) => ({
      id: 'token-id',
      name: data.name,
      createdAt: new Date(),
      expiresAt: data.expiresAt,
      lastUsedAt: null,
    }));

    const created = await importTokenService.create(USER_ID, 'script');

    expect(created.token.startsWith(IMPORT_TOKEN_PREFIX)).toBe(true);
    const stored = repository.create.mock.calls[0][0];
    expect(stored.tokenHash).toBe(sha256(created.token));
    expect(JSON.stringify(stored)).not.toContain(created.token);
  });

  it('expires the token a year out', async () => {
    repository.create.mockImplementation(async (data) => ({ ...data }));
    const before = Date.now();

    await importTokenService.create(USER_ID, 'script');

    const { expiresAt } = repository.create.mock.calls[0][0];
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(365 * DAY_MS);
    expect(expiresAt.getTime() - before).toBeLessThan(366 * DAY_MS);
  });
});

describe('importTokenService.authenticate', () => {
  it('looks the token up by hash and returns its owner', async () => {
    repository.findByHash.mockResolvedValue(storedToken());

    const userId = await importTokenService.authenticate('mxi_secret');

    expect(userId).toBe(USER_ID);
    expect(repository.findByHash).toHaveBeenCalledWith(sha256('mxi_secret'));
    expect(repository.markUsed).toHaveBeenCalledWith(
      'token-id',
      expect.any(Date),
    );
  });

  it('rejects an unknown token', async () => {
    repository.findByHash.mockResolvedValue(null);

    const error = await authError(importTokenService.authenticate('mxi_nope'));

    expect(error.code).toBe('INVALID_IMPORT_TOKEN');
  });

  it('rejects an expired token without recording a use', async () => {
    repository.findByHash.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - 1) }),
    );

    const error = await authError(importTokenService.authenticate('mxi_old'));

    expect(error.code).toBe('IMPORT_TOKEN_EXPIRED');
    expect(repository.markUsed).not.toHaveBeenCalled();
  });

  it('still authenticates when recording the use fails', async () => {
    repository.findByHash.mockResolvedValue(storedToken());
    repository.markUsed.mockRejectedValue(new Error('db down'));

    await expect(importTokenService.authenticate('mxi_secret')).resolves.toBe(
      USER_ID,
    );
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
