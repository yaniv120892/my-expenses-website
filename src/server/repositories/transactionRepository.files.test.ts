import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock('@/server/db/client', () => ({
  default: { transaction: { findUnique } },
}));

import transactionRepository from '@/server/repositories/transactionRepository';
import { toHouseholdId } from '@/server/auth/householdId';

const TRANSACTION_ID = '3f2f1a10-6a37-4dc5-9c5e-1f8a5f4d2b6a';

describe('transactionRepository.getTransactionItem files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue(null);
  });

  it('loads only active files, newest first, since the attachment list reads them from here', async () => {
    await transactionRepository.getTransactionItem(toHouseholdId('household-1'), TRANSACTION_ID);

    expect(findUnique.mock.calls[0]?.[0].include.files).toEqual({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
