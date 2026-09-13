import { describe, expect, it } from 'vitest';
import type { ReconciliationPlanItem } from '@/shared/types/import';
import { deriveReviewHint } from './reconciliationReview';

const createItem = (
  over: Partial<ReconciliationPlanItem> = {},
): ReconciliationPlanItem => ({
  importedTransactionId: 'r1',
  action: 'CREATE',
  description: 'אנימל שופ חנות חיות',
  value: 470,
  date: new Date(2026, 5, 16),
  type: 'EXPENSE',
  categoryId: null,
  match: null,
  ...over,
});

const transaction = (over: Record<string, unknown> = {}) => ({
  id: 'tx-1',
  description: 'אוכל לברונו',
  value: 470,
  date: new Date(2026, 5, 17),
  type: 'EXPENSE' as const,
  status: 'APPROVED' as const,
  ...over,
});

describe('deriveReviewHint for a CREATE', () => {
  it('flags a same-value candidate the matcher did not take', () => {
    const hint = deriveReviewHint(createItem(), null, [transaction()]);

    expect(hint).toEqual({
      reason: 'rejected-candidate',
      counterpart: {
        transactionId: 'tx-1',
        description: 'אוכל לברונו',
        value: 470,
        date: new Date(2026, 5, 17),
        status: 'APPROVED',
      },
      candidateCount: 1,
    });
  });

  it('is null with no candidate in the window', () => {
    expect(deriveReviewHint(createItem(), null, [])).toBeNull();
  });

  it("ignores candidates that belong to another row's window", () => {
    const candidates = [
      transaction({ id: 'too-late', date: new Date(2026, 5, 22) }),
      transaction({ id: 'too-dear', value: 480 }),
      transaction({ id: 'refund', type: 'INCOME' }),
    ];

    expect(deriveReviewHint(createItem(), null, candidates)).toBeNull();
  });

  it('names the closest candidate by value, then date, and counts the rest', () => {
    const candidates = [
      transaction({
        id: 'off-by-one',
        value: 471,
        date: new Date(2026, 5, 16),
      }),
      transaction({ id: 'far-day', date: new Date(2026, 5, 20) }),
      transaction({ id: 'near-day', date: new Date(2026, 5, 15) }),
    ];

    const hint = deriveReviewHint(createItem(), null, candidates);

    expect(hint?.reason).toBe('rejected-candidate');
    expect(hint?.counterpart.transactionId).toBe('near-day');
    expect(hint).toMatchObject({ candidateCount: 3 });
  });
});

describe('deriveReviewHint for a MERGE', () => {
  const mergeItem = (description: string) =>
    createItem({
      action: 'MERGE',
      description,
      match: {
        transactionId: 'tx-1',
        approvesPendingTransaction: false,
        before: {
          description: 'אוכל לברונו',
          value: 470,
          date: new Date(2026, 5, 17),
        },
      },
    });

  it('flags a merge whose descriptions share no word', () => {
    const hint = deriveReviewHint(
      mergeItem('אנימל שופ'),
      transaction({ status: 'PENDING_APPROVAL' }),
      [],
    );

    expect(hint).toEqual({
      reason: 'unrelated-merge',
      counterpart: expect.objectContaining({
        transactionId: 'tx-1',
        status: 'PENDING_APPROVAL',
      }),
    });
  });

  it('is null when a normalized word is shared', () => {
    expect(
      deriveReviewHint(mergeItem('אוכל, לכלב'), transaction(), []),
    ).toBeNull();
  });

  it('never reads a same-value candidate as a rejection on a MERGE', () => {
    expect(
      deriveReviewHint(mergeItem('אוכל לברונו'), transaction(), [
        transaction({ id: 'tx-2', description: 'something else' }),
      ]),
    ).toBeNull();
  });
});
