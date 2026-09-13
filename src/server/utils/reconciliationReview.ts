import type {
  ReconciliationPlanItem,
  ReconciliationReviewHint,
} from '@/shared/types/import';
import type { Transaction } from '@/shared/types/transaction';
import {
  isWithinMatchWindow,
  matchWindow,
  shareNoWord,
} from '@/server/utils/transactionMatching';

type CandidateTransaction = Pick<
  Transaction,
  'id' | 'description' | 'value' | 'date' | 'type' | 'status'
>;

// `candidates` may span many rows' match windows; this narrows them to the item's own.
export function deriveReviewHint(
  item: ReconciliationPlanItem,
  candidates: CandidateTransaction[],
): ReconciliationReviewHint | null {
  switch (item.action) {
    case 'MERGE':
      return unrelatedMergeHint(item);
    case 'CREATE':
      return unmatchedCandidateHint(item, candidates);
    default: {
      const unhandledAction: never = item.action;
      throw new Error(`Unhandled reconciliation action ${unhandledAction}`);
    }
  }
}

function unrelatedMergeHint(
  item: ReconciliationPlanItem,
): ReconciliationReviewHint | null {
  const isUnrelated =
    item.match !== null &&
    shareNoWord(item.description, item.match.before.description);

  return isUnrelated ? { reason: 'unrelated-merge' } : null;
}

function unmatchedCandidateHint(
  item: ReconciliationPlanItem,
  candidates: CandidateTransaction[],
): ReconciliationReviewHint | null {
  const window = matchWindow(item);
  const inWindow = candidates.filter((candidate) =>
    isWithinMatchWindow(window, candidate),
  );
  if (inWindow.length === 0) {
    return null;
  }

  const closest = inWindow.reduce((best, candidate) =>
    isCloser(item, candidate, best) ? candidate : best,
  );
  return {
    reason: 'unmatched-candidate',
    counterpart: {
      transactionId: closest.id,
      description: closest.description,
      value: closest.value,
      date: closest.date,
      status: closest.status,
    },
    candidateCount: inWindow.length,
  };
}

function isCloser(
  item: ReconciliationPlanItem,
  candidate: CandidateTransaction,
  best: CandidateTransaction,
): boolean {
  const valueGap =
    Math.abs(candidate.value - item.value) - Math.abs(best.value - item.value);
  if (valueGap !== 0) {
    return valueGap < 0;
  }

  const time = item.date.getTime();
  return (
    Math.abs(candidate.date.getTime() - time) <
    Math.abs(best.date.getTime() - time)
  );
}
