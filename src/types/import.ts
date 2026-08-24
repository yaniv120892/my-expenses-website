import {
  ImportBankSourceType,
  ImportFileType,
  ImportStatus,
  ImportedTransactionStatus,
} from '@/shared/types/import';
import type { TransactionType } from '@/shared/types/transaction';

export {
  ImportBankSourceType,
  ImportFileType,
  ImportStatus,
  ImportedTransactionStatus,
};

// Mirrors the shared TransactionStatus union as an enum so components can
// reference its values without importing Prisma.
export enum TransactionApprovalStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
}

/** Wire shape of the shared ImportWithVerification: JSON string dates, no server-only fields. */
export interface Import {
  id: string;
  fileUrl: string;
  originalFileName: string;
  importType: ImportFileType;
  bankSourceType?: ImportBankSourceType;
  status: ImportStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
  creditCardLastFourDigits?: string | null;
  paymentMonth?: string | null;
  isVerified: boolean;
}

export interface MatchingTransaction {
  id: string;
  description: string;
  value: number;
  date: string;
  categoryId: string;
  type: TransactionType;
  status: TransactionApprovalStatus;
  userId: string;
}

/** Wire shape of the shared ImportedTransaction, joined with its matching transaction. */
export interface ImportedTransaction {
  id: string;
  importId: string;
  description: string;
  value: number;
  date: string;
  type: string;
  status: ImportedTransactionStatus;
  matchingTransactionId?: string;
  matchingTransaction?: MatchingTransaction;
  rawData: unknown;
  deleted?: boolean;
}

export interface BatchActionRequest {
  importId: string;
  transactionIds?: string[];
  action: 'approve' | 'ignore';
}

export interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: { id: string; error: string }[];
}

export interface AutoApproveRule {
  id: string;
  descriptionPattern: string;
  categoryId: string;
  type: TransactionType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string };
}
