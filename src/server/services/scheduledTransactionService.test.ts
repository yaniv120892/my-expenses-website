import { beforeEach, describe, expect, it, vi } from 'vitest';

const { scheduledRepo, createTransaction } = vi.hoisted(() => ({
  scheduledRepo: {
    getDueScheduledTransactions: vi.fn(),
    claimDueRun: vi.fn(),
    updateLastRunAndNextRun: vi.fn(),
  },
  createTransaction: vi.fn(),
}));

vi.mock('@/server/repositories/scheduledTransactionRepository', () => ({
  default: scheduledRepo,
}));
vi.mock('@/server/services/transactionService', () => ({
  default: { createTransaction },
}));

import scheduledTransactionService from '@/server/services/scheduledTransactionService';

const RUN_DATE = new Date(2026, 8, 22, 7);
const DUE_DATE = new Date(2026, 8, 22);

const schedule = (id: string) => ({
  id,
  userId: 'user-1',
  description: 'Rent',
  value: 1000,
  categoryId: 'cat-1',
  type: 'EXPENSE',
  scheduleType: 'MONTHLY',
  dayOfMonth: 22,
  nextRunDate: DUE_DATE,
});

beforeEach(() => {
  vi.clearAllMocks();
  scheduledRepo.getDueScheduledTransactions.mockResolvedValue([
    schedule('s1'),
    schedule('s2'),
  ]);
  scheduledRepo.claimDueRun.mockResolvedValue(true);
});

describe('processDueScheduledTransactions', () => {
  it('claims each occurrence against the nextRunDate it read', async () => {
    await scheduledTransactionService.processDueScheduledTransactions(RUN_DATE);

    expect(scheduledRepo.claimDueRun).toHaveBeenCalledWith(
      's1',
      DUE_DATE,
      RUN_DATE,
      expect.any(Date),
    );
    expect(createTransaction).toHaveBeenCalledTimes(2);
  });

  it('skips an occurrence an overlapping run already claimed', async () => {
    scheduledRepo.claimDueRun.mockResolvedValueOnce(false);

    await expect(
      scheduledTransactionService.processDueScheduledTransactions(RUN_DATE),
    ).resolves.toBeUndefined();

    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(scheduledRepo.updateLastRunAndNextRun).not.toHaveBeenCalled();
  });
});
