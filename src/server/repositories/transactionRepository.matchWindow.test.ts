import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/server/db/client', () => ({
  default: { transaction: { findMany } },
}));

import transactionRepository from '@/server/repositories/transactionRepository';
import { TransactionType } from '@/generated/prisma/client';

const DAY = new Date(2026, 5, 16);

describe('transactionRepository.findPotentialMatchesForCharges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
  });

  const windowsQueried = () => findMany.mock.calls[0][0].where.OR;

  it('queries a foreign charge whose ILS amount is unknown by currency and original amount', async () => {
    await transactionRepository.findPotentialMatchesForCharges('user-1', [
      {
        date: DAY,
        type: TransactionType.EXPENSE,
        value: null,
        currency: 'USD',
        originalAmount: 25,
      },
    ]);

    expect(windowsQueried()).toEqual([
      expect.objectContaining({
        type: TransactionType.EXPENSE,
        OR: [
          {
            currency: 'USD',
            originalAmount: { gte: 23, lte: 27 },
          },
        ],
      }),
      expect.objectContaining({
        scheduledTransaction: { bankDescriptionPrefix: { not: null } },
      }),
    ]);
  });

  it('queries variable-amount placeholders once per direction, across every window, at any value', async () => {
    const charge = (date: Date) => ({
      date,
      type: TransactionType.EXPENSE,
      value: 101.98,
      currency: 'ILS',
      originalAmount: 101.98,
    });

    await transactionRepository.findPotentialMatchesForCharges('user-1', [
      charge(new Date(2026, 5, 10)),
      charge(new Date(2026, 5, 20)),
    ]);

    const placeholderClauses = windowsQueried().filter(
      (clause: Record<string, unknown>) => 'scheduledTransaction' in clause,
    );
    expect(placeholderClauses).toEqual([
      {
        type: TransactionType.EXPENSE,
        date: { gte: new Date(2026, 5, 5), lte: new Date(2026, 5, 25) },
        status: 'PENDING_APPROVAL',
        scheduledTransaction: { bankDescriptionPrefix: { not: null } },
      },
    ]);
  });

  it('queries a billed foreign charge by its ILS value or its original amount', async () => {
    await transactionRepository.findPotentialMatchesForCharges('user-1', [
      {
        date: DAY,
        type: TransactionType.EXPENSE,
        value: 92.35,
        currency: 'USD',
        originalAmount: 25,
      },
    ]);

    expect(windowsQueried()[0].OR).toEqual([
      { value: { gte: 90.35, lte: 94.35 } },
      { currency: 'USD', originalAmount: { gte: 23, lte: 27 } },
    ]);
  });

  it('skips the query when no charge can match', async () => {
    const matches = await transactionRepository.findPotentialMatchesForCharges(
      'user-1',
      [
        {
          date: DAY,
          type: TransactionType.EXPENSE,
          value: null,
          currency: null,
          originalAmount: 25,
        },
      ],
    );

    expect(matches).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
