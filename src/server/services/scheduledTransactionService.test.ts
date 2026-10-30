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
import { toHouseholdId } from '@/server/auth/householdId';

const RUN_DATE = new Date(2026, 8, 22, 7);
const DUE_DATE = new Date(2026, 8, 22);

const HOUSEHOLD_A = toHouseholdId('household-a');
const HOUSEHOLD_B = toHouseholdId('household-b');
const LAST_RUN_DATE = new Date(2026, 7, 22);

const schedule = (id: string, householdId = HOUSEHOLD_A) => ({
  id,
  householdId,
  userId: 'user-1',
  lastRunDate: LAST_RUN_DATE,
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
  scheduledRepo.getDueScheduledTransactions.mockResolvedValue([schedule('s1'), schedule('s2')]);
  scheduledRepo.claimDueRun.mockResolvedValue(true);
});

describe('processDueScheduledTransactions', () => {
  it('claims each occurrence against the nextRunDate it read', async () => {
    await scheduledTransactionService.processDueScheduledTransactions(RUN_DATE);

    expect(scheduledRepo.claimDueRun).toHaveBeenCalledWith({
      householdId: HOUSEHOLD_A,
      id: 's1',
      readNextRunDate: DUE_DATE,
      lastRunDate: RUN_DATE,
      nextRunDate: expect.any(Date),
    });
    expect(createTransaction).toHaveBeenCalledTimes(2);
  });

  it('links each pending transaction to the schedule that projected it', async () => {
    await scheduledTransactionService.processDueScheduledTransactions(RUN_DATE);

    expect(createTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'PENDING_APPROVAL',
        scheduledTransactionId: 's1',
      }),
    );
  });

  it('skips an occurrence an overlapping run already claimed', async () => {
    scheduledRepo.claimDueRun.mockResolvedValueOnce(false);

    await expect(
      scheduledTransactionService.processDueScheduledTransactions(RUN_DATE),
    ).resolves.toBeUndefined();

    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(scheduledRepo.updateLastRunAndNextRun).not.toHaveBeenCalled();
  });

  it("writes each occurrence as the cron's system actor in the schedule's own household", async () => {
    scheduledRepo.getDueScheduledTransactions.mockResolvedValue([
      schedule('s1', HOUSEHOLD_A),
      schedule('s2', HOUSEHOLD_B),
    ]);

    await scheduledTransactionService.processDueScheduledTransactions(RUN_DATE);

    expect(createTransaction.mock.calls.map(([actor]) => actor)).toEqual([
      { kind: 'system', householdId: HOUSEHOLD_A, job: 'scheduled-transactions' },
      { kind: 'system', householdId: HOUSEHOLD_B, job: 'scheduled-transactions' },
    ]);
    expect(createTransaction.mock.calls[1]?.[1]).toMatchObject({ scheduledTransactionId: 's2' });
    expect(createTransaction.mock.calls[0]?.[1]).not.toHaveProperty('userId');
  });

  it('rolls a failed occurrence back to the run dates it read, in its household', async () => {
    createTransaction.mockRejectedValueOnce(new Error('db blip'));

    await expect(
      scheduledTransactionService.processDueScheduledTransactions(RUN_DATE),
    ).rejects.toThrow('Scheduled transaction processing failed for 1 of 2 schedule(s)');

    expect(scheduledRepo.updateLastRunAndNextRun).toHaveBeenCalledTimes(1);
    expect(scheduledRepo.updateLastRunAndNextRun).toHaveBeenCalledWith({
      householdId: HOUSEHOLD_A,
      id: 's1',
      lastRunDate: LAST_RUN_DATE,
      nextRunDate: DUE_DATE,
    });
    expect(createTransaction).toHaveBeenCalledTimes(2);
  });
});
