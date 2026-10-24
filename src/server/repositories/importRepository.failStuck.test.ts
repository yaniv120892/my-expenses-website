import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, updateMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock('@/server/db/client', () => ({
  default: { import: { findMany, updateMany } },
}));

import { importRepository } from '@/server/repositories/importRepository';

const cutoff = new Date('2026-10-24T00:00:00Z');

describe('importRepository.failStuckProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails and claims only imports still PROCESSING from before the cutoff', async () => {
    findMany.mockResolvedValue([{ id: 'imp-1' }, { id: 'imp-2' }]);
    updateMany.mockResolvedValue({ count: 1 });

    const sweep = await importRepository.failStuckProcessing(cutoff, 'stuck');

    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'PROCESSING', createdAt: { lt: cutoff } },
      select: { id: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['imp-1', 'imp-2'] }, status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        error: 'stuck',
        extractionCompletedAt: expect.any(Date),
      },
    });
    expect(sweep).toEqual({ importIds: ['imp-1', 'imp-2'], failedCount: 1 });
  });

  it('writes nothing when no import is stuck', async () => {
    findMany.mockResolvedValue([]);

    const sweep = await importRepository.failStuckProcessing(cutoff, 'stuck');

    expect(updateMany).not.toHaveBeenCalled();
    expect(sweep).toEqual({ importIds: [], failedCount: 0 });
  });
});
