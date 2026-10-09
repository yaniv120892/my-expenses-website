import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addYears } from 'date-fns';

const { repository } = vi.hoisted(() => ({
  repository: { create: vi.fn() },
}));

vi.mock('@/server/repositories/apiTokenRepository', () => ({
  apiTokenRepository: repository,
}));

import { apiTokenService } from '@/server/services/apiTokenService';

const USER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  repository.create.mockImplementation(async (data) => ({
    id: 'token-id',
    name: data.name,
    scopes: data.scopes,
    createdAt: new Date(),
    expiresAt: data.expiresAt,
    lastUsedAt: null,
  }));
});

describe('apiTokenService.create', () => {
  it('returns a prefixed token and stores only its hash', async () => {
    const created = await apiTokenService.create(USER_ID, 'script', [
      'IMPORTS',
    ]);

    expect(created.token.startsWith('mxk_')).toBe(true);
    const stored = repository.create.mock.calls[0][0];
    expect(stored.tokenHash).toBe(
      createHash('sha256').update(created.token).digest('hex'),
    );
    expect(JSON.stringify(stored)).not.toContain(created.token);
  });

  it('stores each requested scope once', async () => {
    await apiTokenService.create(USER_ID, 'script', ['IMPORTS', 'IMPORTS']);

    expect(repository.create.mock.calls[0][0].scopes).toEqual(['IMPORTS']);
  });

  it('expires the token a year out', async () => {
    const before = new Date();

    await apiTokenService.create(USER_ID, 'script', ['IMPORTS']);

    const { expiresAt } = repository.create.mock.calls[0][0];
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
      addYears(before, 1).getTime(),
    );
    expect(expiresAt.getTime()).toBeLessThan(
      addYears(before, 1).getTime() + 60_000,
    );
  });
});
