import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/server/db/client', () => ({
  default: { importedTransaction: { findMany } },
}));

import { importedTransactionRepository } from '@/server/repositories/importedTransactionRepository';

// An import deleted before its rows were deleted with it left them live.
describe('reads of pending rows skip the rows of a deleted import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([{ matchingTransactionId: 'tx-1' }]);
  });

  const where = () => findMany.mock.calls[0][0].where;

  it('in the claims a re-import must not be blocked by', async () => {
    const claimed = await importedTransactionRepository.findClaimedMatchingTransactionIds('user-1');

    expect(claimed).toEqual(['tx-1']);
    expect(where()).toMatchObject({
      userId: 'user-1',
      deleted: false,
      import: { deleted: false },
    });
  });

  it('in the rows a batch approves by id', async () => {
    await importedTransactionRepository.findPendingByIds('imp-1', ['r1'], 'user-1');

    expect(where()).toMatchObject({ import: { deleted: false } });
  });

  it('in the rows a batch approves in full', async () => {
    await importedTransactionRepository.findPendingByImportId('imp-1', 'user-1');

    expect(where()).toMatchObject({ import: { deleted: false } });
  });
});
