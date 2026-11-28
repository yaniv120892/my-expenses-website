import type { Transaction } from '@/shared/types/transaction';

export enum TransactionNotifierType {
  TELEGRAM = 'TELEGRAM',
}

export type TransactionNotifier = {
  /** A batch is one announcement, so a bulk import cannot flood the chat. */
  notifyTransactionsCreated(transactions: Transaction[], userId: string): Promise<void>;
  sendDailySummary(dailySummary: string, userId: string): Promise<void>;
};
