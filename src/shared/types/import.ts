import type { TransactionStatus, TransactionType } from './transaction';

export enum ImportFileType {
  VISA_CREDIT = 'VISA_CREDIT',
  MASTERCARD_CREDIT = 'MASTERCARD_CREDIT',
  AMERICAN_EXPRESS_CREDIT = 'AMERICAN_EXPRESS_CREDIT',
}

export enum ImportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REMATCHING = 'REMATCHING',
  MERGED = 'MERGED',
}

export enum ImportedTransactionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  MERGED = 'MERGED',
  IGNORED = 'IGNORED',
}

export enum ImportBankSourceType {
  NON_BANK_CREDIT = 'NON_BANK_CREDIT',
  BANK_CREDIT = 'BANK_CREDIT',
}

export type ReconciliationAction = 'MERGE' | 'CREATE';

export type ReconciliationBefore = {
  description: string;
  value: number;
  date: Date;
};

export type ReconciliationMatch = {
  transactionId: string;
  // Merging onto a pending transaction is what approves it; onto an already
  // approved one the merge is only an edit.
  approvesPendingTransaction: boolean;
  before: ReconciliationBefore;
};

export type ReconciliationPlanItem = {
  importedTransactionId: string;
  action: ReconciliationAction;
  description: string;
  value: number;
  date: Date;
  type: TransactionType;
  categoryId: string | null;
  match: ReconciliationMatch | null;
};

export type ReconciliationCounterpart = {
  transactionId: string;
  description: string;
  value: number;
  date: Date;
  status: TransactionStatus;
};

// `counterpart` is the closest of `candidateCount`.
export type ReconciliationReviewHint =
  | {
      reason: 'unmatched-candidate';
      counterpart: ReconciliationCounterpart;
      candidateCount: number;
    }
  | { reason: 'unrelated-merge' };

export type ReconciliationPreviewItem = ReconciliationPlanItem & {
  reviewHint: ReconciliationReviewHint | null;
};

// The benign 409 rematchImport throws when another call already re-matched the
// survivor's rows, shared so callers match this exact text rather than a copy.
export const NO_PENDING_TRANSACTIONS_TO_REMATCH_ERROR =
  'No pending transactions to re-match';
