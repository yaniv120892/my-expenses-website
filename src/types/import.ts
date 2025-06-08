import { TransactionType } from "./index";

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
  originalFileName: string;
  importType: ImportFileType;
  status: ImportStatus;
  error?: string;
  createdAt: string;
  creditCardLastFourDigits?: string | null;
  paymentMonth?: string | null;
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
