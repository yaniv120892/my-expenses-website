import type {
  ReconciliationPlanItem,
  ReconciliationReviewHint,
} from '@/shared/types/import';
import type { Transaction } from '@/shared/types/transaction';
import {
  dateDistance,
  isVariableAmountPlaceholder,
  matchCandidateFilter,
  shareNoWord,
} from '@/server/utils/transactionMatching';

type CandidateTransaction = Pick<
  Transaction,
  | 'id'
  | 'description'
  | 'value'
  | 'currency'
  | 'originalAmount'
  | 'date'
  | 'type'
  | 'status'
> & { bankDescriptionPrefix: string | null };

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
    !item.match.matchedByBankDescriptionPrefix &&
    shareNoWord(item.description, item.match.before.description);

  return isUnrelated ? { reason: 'unrelated-merge' } : null;
}

function unmatchedCandidateHint(
  item: ReconciliationPlanItem,
  candidates: CandidateTransaction[],
): ReconciliationReviewHint | null {
  const inWindow = candidates.filter(matchCandidateFilter(item));
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
      currency: closest.currency,
      originalAmount: closest.originalAmount,
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
  // A placeholder fits by the prefix the user declared; its projected value is
  // no measure of how close it is.
  const placeholderFirst =
    Number(isVariableAmountPlaceholder(best)) -
    Number(isVariableAmountPlaceholder(candidate));
  if (placeholderFirst !== 0) {
    return placeholderFirst < 0;
  }

  const valueGap =
    item.value === null
      ? Math.abs(candidate.originalAmount - item.originalAmount) -
        Math.abs(best.originalAmount - item.originalAmount)
      : Math.abs(candidate.value - item.value) -
        Math.abs(best.value - item.value);
  if (valueGap !== 0) {
    return valueGap < 0;
  }

  return dateDistance(item, candidate) < dateDistance(item, best);
}
