import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, updateMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock('@/server/db/client', () => ({
  default: {},
  systemPrisma: { import: { findMany, updateMany } },
}));

import crossHouseholdRepository from '@/server/repositories/crossHouseholdRepository';

const cutoff = new Date('2026-10-24T00:00:00Z');

describe('crossHouseholdRepository.failStuckImports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails and claims only imports still PROCESSING from before the cutoff', async () => {
    findMany.mockResolvedValue([{ id: 'imp-1' }, { id: 'imp-2' }]);
    updateMany.mockResolvedValue({ count: 1 });

    const sweep = await crossHouseholdRepository.failStuckImports(cutoff, 'stuck');

    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'PROCESSING', createdAt: { lt: cutoff } },
      select: { id: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['imp-1', 'imp-2'] },
        status: 'PROCESSING',
        OR: [{ extractionCompletedAt: null }, { extractionCompletedAt: { lt: expect.any(Date) } }],
      },
      data: {
        status: 'FAILED',
        error: 'stuck',
        extractionCompletedAt: expect.any(Date),
      },
    });
    expect(sweep).toEqual({ importIds: ['imp-1', 'imp-2'], failedCount: 1 });
  });

  it('leaves an import whose callback claimed it within the grace to finish', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-24T06:00:00Z') });
    findMany.mockResolvedValue([{ id: 'imp-1' }]);
    updateMany.mockResolvedValue({ count: 0 });

    await crossHouseholdRepository.failStuckImports(cutoff, 'stuck');

    const where = updateMany.mock.calls[0]?.[0]?.where;
    expect(where?.OR[1].extractionCompletedAt.lt).toEqual(new Date('2026-10-24T05:45:00Z'));
    vi.useRealTimers();
  });

  it('writes nothing when no import is stuck', async () => {
    findMany.mockResolvedValue([]);

    const sweep = await crossHouseholdRepository.failStuckImports(cutoff, 'stuck');

    expect(updateMany).not.toHaveBeenCalled();
    expect(sweep).toEqual({ importIds: [], failedCount: 0 });
  });
});
