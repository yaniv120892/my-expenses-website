import type {
  ReconciliationCounterpart,
  ReconciliationPlanItem,
  ReconciliationReviewHint,
} from '@/shared/types/import';
import type {
  TransactionStatus,
  TransactionType,
} from '@/shared/types/transaction';
import {
  isWithinMatchWindow,
  matchWindow,
  shareNoWord,
} from '@/server/utils/transactionMatching';

type ExistingTransaction = {
  id: string;
  description: string;
  value: number;
  date: Date;
  status: TransactionStatus;
};

type CandidateTransaction = ExistingTransaction & { type: TransactionType };

/**
 * The review hint for an already-decided plan item. `matched` is the
 * transaction a MERGE lands on; `candidates` may span many rows' windows and
 * is narrowed to this item's own here.
 */
export function deriveReviewHint(
  item: ReconciliationPlanItem,
  matched: ExistingTransaction | null,
  candidates: CandidateTransaction[],
): ReconciliationReviewHint | null {
  switch (item.action) {
    case 'MERGE':
      return unrelatedMergeHint(item, matched);
    case 'CREATE':
      return rejectedCandidateHint(item, candidates);
    default:
      return null;
  }
}

function unrelatedMergeHint(
  item: ReconciliationPlanItem,
  matched: ExistingTransaction | null,
): ReconciliationReviewHint | null {
  if (!matched || !shareNoWord(item.description, matched.description)) {
    return null;
  }

  return { reason: 'unrelated-merge', counterpart: toCounterpart(matched) };
}

function rejectedCandidateHint(
  item: ReconciliationPlanItem,
  candidates: CandidateTransaction[],
): ReconciliationReviewHint | null {
  const window = matchWindow(item.date, item.value);
  const inWindow = candidates.filter(
    (candidate) =>
      candidate.type === item.type && isWithinMatchWindow(window, candidate),
  );
  if (inWindow.length === 0) {
    return null;
  }

  const [closest] = [...inWindow].sort(
    (a, b) =>
      valueDistance(item, a) - valueDistance(item, b) ||
      dateDistance(item, a) - dateDistance(item, b),
  );
  return {
    reason: 'rejected-candidate',
    counterpart: toCounterpart(closest),
    candidateCount: inWindow.length,
  };
}

function valueDistance(
  item: ReconciliationPlanItem,
  candidate: CandidateTransaction,
): number {
  return Math.abs(candidate.value - item.value);
}

function dateDistance(
  item: ReconciliationPlanItem,
  candidate: CandidateTransaction,
): number {
  return Math.abs(candidate.date.getTime() - item.date.getTime());
}

function toCounterpart(
  transaction: ExistingTransaction,
): ReconciliationCounterpart {
  return {
    transactionId: transaction.id,
    description: transaction.description,
    value: transaction.value,
    date: transaction.date,
    status: transaction.status,
  };
}
