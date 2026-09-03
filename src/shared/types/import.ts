// Type-only imports: this module is also bundled client-side (src/types/import
// re-exports its enums), so it must not pull in @prisma/client at runtime.
import type { Prisma } from '@prisma/client';
import type { TransactionType } from './transaction';

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
}

export interface ImportWithVerification extends Import {
  isVerified: boolean;
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
