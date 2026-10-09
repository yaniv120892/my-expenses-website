import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addYears } from 'date-fns';

const { repository } = vi.hoisted(() => ({
  repository: { create: vi.fn() },
}));

vi.mock('@/server/repositories/importTokenRepository', () => ({
  importTokenRepository: repository,
}));

import { importTokenService } from '@/server/services/importTokenService';

const USER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  repository.create.mockImplementation(async (data) => ({
    id: 'token-id',
    name: data.name,
    createdAt: new Date(),
    expiresAt: data.expiresAt,
    lastUsedAt: null,
  }));
});

describe('importTokenService.create', () => {
  it('returns a prefixed token and stores only its hash', async () => {
    const created = await importTokenService.create(USER_ID, 'script');

    expect(created.token.startsWith('mxi_')).toBe(true);
    const stored = repository.create.mock.calls[0][0];
    expect(stored.tokenHash).toBe(
      createHash('sha256').update(created.token).digest('hex'),
    );
    expect(JSON.stringify(stored)).not.toContain(created.token);
  });

  it('expires the token a year out', async () => {
    const before = new Date();

    await importTokenService.create(USER_ID, 'script');

    const { expiresAt } = repository.create.mock.calls[0][0];
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
      addYears(before, 1).getTime(),
    );
    expect(expiresAt.getTime()).toBeLessThan(
      addYears(before, 1).getTime() + 60_000,
    );
  });
});
