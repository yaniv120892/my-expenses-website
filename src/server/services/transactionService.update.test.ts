import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getTransactionItem, updateTransaction, upsert, getRateToBase } =
  vi.hoisted(() => ({
    getTransactionItem: vi.fn(),
    updateTransaction: vi.fn(),
    upsert: vi.fn(),
    getRateToBase: vi.fn(),
  }));

vi.mock('@/server/repositories/transactionRepository', () => ({
  default: { getTransactionItem, updateTransaction },
}));
vi.mock('@/server/repositories/userCategoryMappingRepository', () => ({
  default: { upsert },
}));
vi.mock('@/server/services/exchangeRateService', () => ({
  default: { getRateToBase },
}));

import transactionService from '@/server/services/transactionService';
import type { Transaction } from '@/shared/types/transaction';

const DAY = new Date(2026, 7, 8);

const statementUsdCharge: Transaction = {
  id: 'tx-1',
  description: 'Amazon',
  value: 92.35,
  currency: 'USD',
  originalAmount: 25,
  exchangeRate: 3.694,
  exchangeRateDate: DAY,
  exchangeRateSource: 'STATEMENT',
  date: DAY,
  type: 'EXPENSE',
  status: 'APPROVED',
  category: { id: 'cat-shop', name: 'Shopping' },
};

const edit = (over: Record<string, unknown>) => ({
  description: 'Amazon order',
  categoryId: 'cat-shop',
  type: 'EXPENSE' as const,
  date: DAY,
  ...over,
});

describe('transactionService.updateTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTransactionItem.mockResolvedValue(statementUsdCharge);
    updateTransaction.mockResolvedValue('tx-1');
  });

  it('keeps the statement conversion when an edit leaves amount and day alone', async () => {
    await transactionService.updateTransaction(
      'tx-1',
      edit({ value: 92.35 }),
      'user-1',
    );

    expect(getRateToBase).not.toHaveBeenCalled();
    expect(updateTransaction).toHaveBeenCalledWith(
      'tx-1',
      expect.objectContaining({
        description: 'Amazon order',
        amount: {
          value: 92.35,
          currency: 'USD',
          originalAmount: 25,
          exchangeRate: 3.694,
          exchangeRateDate: DAY,
          exchangeRateSource: 'STATEMENT',
        },
      }),
      'user-1',
    );
  });

  it('re-converts when the edit changes the foreign amount', async () => {
    getRateToBase.mockResolvedValue({
      rate: '3.70000000',
      rateDate: '2026-08-07',
    });

    await transactionService.updateTransaction(
      'tx-1',
      edit({ currency: 'USD', originalAmount: 30 }),
      'user-1',
    );

    expect(updateTransaction.mock.calls[0][1].amount).toMatchObject({
      value: 111,
      originalAmount: 30,
      exchangeRateSource: 'BANK_OF_ISRAEL',
    });
  });

  it('404s an edit of a transaction that is not the user’s', async () => {
    getTransactionItem.mockResolvedValue(null);

    await expect(
      transactionService.updateTransaction(
        'tx-1',
        edit({ value: 1 }),
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(updateTransaction).not.toHaveBeenCalled();
  });
});
