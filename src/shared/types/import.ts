import { Prisma } from '@prisma/client';
import { TransactionStatus, TransactionType } from './transaction';

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
}

export interface Import {
  id: string;
  userId: string;
  fileUrl: string;
  originalFileName: string;
  importType?: ImportFileType;
  bankSourceType?: string;
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
  status: TransactionStatus;
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
