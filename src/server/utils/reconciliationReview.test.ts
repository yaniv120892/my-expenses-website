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
    const hint = deriveReviewHint(createItem(), [transaction()]);

    expect(hint).toEqual({
      reason: 'unmatched-candidate',
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
    expect(deriveReviewHint(createItem(), [])).toBeNull();
  });

  it("ignores candidates that belong to another row's window", () => {
    const candidates = [
      transaction({ id: 'too-late', date: new Date(2026, 5, 22) }),
      transaction({ id: 'too-dear', value: 480 }),
      transaction({ id: 'refund', type: 'INCOME' }),
    ];

    expect(deriveReviewHint(createItem(), candidates)).toBeNull();
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

    const hint = deriveReviewHint(createItem(), candidates);

    expect(hint).toMatchObject({
      reason: 'unmatched-candidate',
      counterpart: { transactionId: 'near-day' },
      candidateCount: 3,
    });
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
    expect(deriveReviewHint(mergeItem('אנימל שופ'), [])).toEqual({
      reason: 'unrelated-merge',
    });
  });

  it('is null when a normalized word is shared', () => {
    expect(deriveReviewHint(mergeItem('אוכל, לכלב'), [])).toBeNull();
  });

  it('never reads an in-window candidate as unmatched on a MERGE', () => {
    expect(
      deriveReviewHint(mergeItem('אוכל לברונו'), [
        transaction({ id: 'tx-2', description: 'something else' }),
      ]),
    ).toBeNull();
  });
});
