import { TransactionType } from "./index";

export enum TransactionApprovalStatus {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
}

export enum ImportFileType {
  VISA_CREDIT = "VISA_CREDIT",
  MASTERCARD_CREDIT = "MASTERCARD_CREDIT",
  AMERICAN_EXPRESS_CREDIT = "AMERICAN_EXPRESS_CREDIT",
}

export enum ImportStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REMATCHING = "REMATCHING",
}

export enum ImportedTransactionStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  MERGED = "MERGED",
  IGNORED = "IGNORED",
}

export enum ImportBankSourceType {
  NON_BANK_CREDIT = "NON_BANK_CREDIT",
  BANK_CREDIT = "BANK_CREDIT",
}

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
  errors: Array<{ id: string; error: string }>;
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
