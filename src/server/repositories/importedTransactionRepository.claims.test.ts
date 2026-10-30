import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/server/db/client', () => ({
  default: { importedTransaction: { findMany } },
}));

import { importedTransactionRepository } from '@/server/repositories/importedTransactionRepository';
import { toHouseholdId } from '@/server/auth/householdId';

const HOUSEHOLD_ID = toHouseholdId('household-1');

// An import deleted before its rows were deleted with it left them live.
describe('reads of pending rows skip the rows of a deleted import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([{ matchingTransactionId: 'tx-1' }]);
  });

  const where = () => findMany.mock.calls[0]?.[0].where;

  it('in the claims a re-import must not be blocked by', async () => {
    const claimed =
      await importedTransactionRepository.findClaimedMatchingTransactionIds(HOUSEHOLD_ID);

    expect(claimed).toEqual(['tx-1']);
    expect(where()).toMatchObject({
      householdId: HOUSEHOLD_ID,
      deleted: false,
      import: { deleted: false },
    });
  });

  it('in the rows a batch approves by id', async () => {
    await importedTransactionRepository.findPendingByIds(HOUSEHOLD_ID, 'imp-1', ['r1']);

    expect(where()).toMatchObject({ import: { deleted: false } });
  });

  it('in the rows a batch approves in full', async () => {
    await importedTransactionRepository.findPendingByImportId(HOUSEHOLD_ID, 'imp-1');

    expect(where()).toMatchObject({ import: { deleted: false } });
  });
});
