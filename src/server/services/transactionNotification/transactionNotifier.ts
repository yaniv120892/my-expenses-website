import type { Transaction } from '@/shared/types/transaction';

export enum TransactionNotifierType {
  TELEGRAM = 'TELEGRAM',
}

export type TransactionNotifier = {
  notifyTransactionCreated(transaction: Transaction, userId: string): Promise<void>;
  sendDailySummary(dailySummary: string, userId: string): Promise<void>;
};
