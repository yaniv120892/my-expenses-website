import { describe, expect, it } from 'vitest';
import type { ReconciliationPreviewItem } from '../../src/shared/types/import';
import { describePlanItem, reviewReminder } from './reconciliationTable';

const counterpart = {
  transactionId: 'tx-1',
  description: 'אוכל לברונו',
  value: 470,
  date: new Date(2026, 5, 17),
  status: 'APPROVED' as const,
};

const item = (
  over: Partial<ReconciliationPreviewItem> = {},
): ReconciliationPreviewItem => ({
  importedTransactionId: 'r1',
  action: 'CREATE',
  description: 'אנימל שופ חנות חיות',
  value: 470,
  date: new Date(2026, 5, 16),
  type: 'EXPENSE',
  categoryId: null,
  match: null,
  reviewHint: null,
  ...over,
});

const merge = (
  over: Partial<ReconciliationPreviewItem> = {},
  approvesPendingTransaction = true,
) =>
  item({
    action: 'MERGE',
    description: 'Netflix',
    match: {
      transactionId: 'tx-1',
      approvesPendingTransaction,
      before: {
        description: 'Netflix',
        value: 470,
        date: new Date(2026, 5, 16),
      },
    },
    ...over,
  });

describe('describePlanItem', () => {
  it('prints an unflagged CREATE as before', () => {
    expect(describePlanItem(item())).toBe(
      'CREATE  2026-06-16     470.00  אנימל שופ חנות חיות',
    );
  });

  it('marks a CREATE with an unmatched candidate and names it', () => {
    const line = describePlanItem(
      item({
        reviewHint: {
          reason: 'unmatched-candidate',
          counterpart,
          candidateCount: 2,
        },
      }),
    );

    expect(line).toBe(
      'CREATE? 2026-06-16     470.00  אנימל שופ חנות חיות\n' +
        '            check: not matched to "אוכל לברונו" 470.00 on 2026-06-17 (approved) (+1 more)',
    );
  });

  it('prints an unflagged MERGE as before', () => {
    expect(describePlanItem(merge())).toBe(
      'MERGE   2026-06-16     470.00  Netflix (approves pending)',
    );
  });

  it('marks an unrelated MERGE with the other side in its diff', () => {
    const line = describePlanItem(
      merge(
        {
          description: 'Pizza Place',
          reviewHint: { reason: 'unrelated-merge' },
        },
        false,
      ),
    );

    expect(line).toBe(
      'MERGE?  2026-06-16     470.00  Pizza Place\n' +
        '            check: the merged descriptions share no word\n' +
        '            description "Netflix" -> "Pizza Place"',
    );
  });

  it('keeps a MERGE diff on its continuation line', () => {
    expect(describePlanItem(merge({ value: 471 }))).toBe(
      'MERGE   2026-06-16     471.00  Netflix (approves pending)\n' +
        '            value 470.00 -> 471.00',
    );
  });

  it('accepts dates serialized as JSON strings', () => {
    const serialized = JSON.parse(JSON.stringify(item()));
    expect(describePlanItem(serialized)).toContain('2026-06-1');
  });
});

describe('reviewReminder', () => {
  it('is null when nothing is flagged', () => {
    expect(reviewReminder([item(), merge()])).toBeNull();
  });

  it('does not count rows from a server that sends no reviewHint', () => {
    const { reviewHint: _omitted, ...withoutHint } = item();
    const legacyRows = JSON.parse(JSON.stringify([withoutHint, withoutHint]));

    expect(reviewReminder(legacyRows)).toBeNull();
  });

  it('counts the flagged rows', () => {
    const flagged = item({
      reviewHint: {
        reason: 'unmatched-candidate',
        counterpart,
        candidateCount: 1,
      },
    });

    expect(reviewReminder([flagged, merge(), flagged])).toBe(
      '2 row(s) marked CREATE? or MERGE? above are close calls; review them before confirming.',
    );
  });
});
