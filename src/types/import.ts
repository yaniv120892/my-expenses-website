import { TransactionType } from "./index";

export enum ImportFileType {
  CAL_CREDIT = "CAL_CREDIT",
  AMERICAN_EXPRESS_CREDIT = "AMERICAN_EXPRESS_CREDIT",
  ISRACARD_CREDIT = "ISRACARD_CREDIT",
}

export enum ImportStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum ImportedTransactionStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  MERGED = "MERGED",
  IGNORED = "IGNORED",
}

export interface Import {
  id: string;
  fileUrl: string;
  importType: ImportFileType;
  status: ImportStatus;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface MatchingTransaction {
  id: string;
  description: string;
  value: number;
  date: string;
  categoryId: string;
  type: TransactionType;
  status: ImportedTransactionStatus;
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
