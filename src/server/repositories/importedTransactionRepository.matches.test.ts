import { beforeEach, describe, expect, it, vi } from 'vitest';

const { update, updateMany } = vi.hoisted(() => ({ update: vi.fn(), updateMany: vi.fn() }));
vi.mock('@/server/db/client', () => ({
  default: { importedTransaction: { update, updateMany } },
}));

import { importedTransactionRepository } from '@/server/repositories/importedTransactionRepository';
import { toHouseholdId } from '@/server/auth/householdId';

const HOUSEHOLD_ID = toHouseholdId('household-1');

describe('importedTransactionRepository match writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears only the import's pending rows' matches", async () => {
    await importedTransactionRepository.clearPendingMatches(HOUSEHOLD_ID, 'imp-1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { importId: 'imp-1', householdId: HOUSEHOLD_ID, status: 'PENDING' },
      data: { matchingTransactionId: null },
    });
  });

  it('stores the match on the row, scoped to the household', async () => {
    await importedTransactionRepository.setMatchingTransaction(HOUSEHOLD_ID, 'r1', 'tx-a');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1', householdId: HOUSEHOLD_ID },
      data: { matchingTransactionId: 'tx-a' },
    });
  });
});
