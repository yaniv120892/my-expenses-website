// Type-only imports: this module is also bundled client-side (src/types/import
// re-exports its enums), so it must not pull in @prisma/client at runtime.
import type { Prisma } from '@prisma/client';
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
  // A duplicate of an older import for the same card and month; its rows live
  // under the import mergedIntoImportId names.
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

export interface Import {
  id: string;
  userId: string;
  fileUrl: string;
  originalFileName: string;
  importType?: ImportFileType;
  bankSourceType?: ImportBankSourceType;
  status: ImportStatus;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  creditCardLastFourDigits?: string;
  paymentMonth?: string;
  excelExtractionRequestId?: string;
  mergedIntoImportId?: string | null;
}

export interface ImportWithVerification extends Import {
  isVerified: boolean;
  mergedIntoFileName?: string | null;
}

export interface ImportedTransaction {
  id: string;
  importId: string;
  description: string;
  value: number;
  date: Date;
  type: TransactionType;
  status: ImportedTransactionStatus;
  matchingTransactionId?: string;
  rawData: Prisma.InputJsonValue;
  userId: string;
}

export interface ImportQueueMessage {
  importId: string;
  fileUrl: string;
  importType: ImportFileType;
  userId: string;
}

export type ReconciliationAction = 'MERGE' | 'CREATE';

/** The matched transaction as it stands, before a merge overwrites it. */
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

/**
 * What approving one imported row would do, resolved before anything is
 * written. The batch that commits is driven by these same items, so a preview
 * cannot describe an outcome the commit would not produce.
 */
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

/** The existing transaction a review hint puts beside a planned row. */
export type ReconciliationCounterpart = {
  transactionId: string;
  description: string;
  value: number;
  date: Date;
  status: TransactionStatus;
};

/**
 * Why a planned row is worth a human's look before committing. Informational
 * only: the action is decided before the hint is derived and never changes.
 * `rejected-candidate` is a CREATE with a transaction inside its match window
 * (the closest one, of `candidateCount`); `unrelated-merge` is a MERGE onto a
 * transaction whose description shares no word with the row's.
 */
export type ReconciliationReviewHint =
  | {
      reason: 'rejected-candidate';
      counterpart: ReconciliationCounterpart;
      candidateCount: number;
    }
  | {
      reason: 'unrelated-merge';
      counterpart: ReconciliationCounterpart;
    };

/** A plan item as the reconciliation preview returns it. */
export type ReconciliationPreviewItem = ReconciliationPlanItem & {
  reviewHint: ReconciliationReviewHint | null;
};

// The 409 rematchImport throws when a survivor's pending rows were already
// re-matched by another call — a benign no-op, distinct from its other 409
// (import not COMPLETED). Shared so a caller distinguishing the two, such as
// scripts/import-statements.ts, matches this exact text rather than a copy.
export const NO_PENDING_TRANSACTIONS_TO_REMATCH_ERROR =
  'No pending transactions to re-match';
