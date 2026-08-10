import { Transaction } from '@/shared/types/transaction';

export enum TransactionNotifierType {
  TELEGRAM = 'TELEGRAM',
}

export interface TransactionNotifier {
  notifyTransactionCreated(
    transaction: Transaction,
    userId: string,
  ): Promise<void>;
  sendDailySummary(dailySummary: string, userId: string): Promise<void>;
}
