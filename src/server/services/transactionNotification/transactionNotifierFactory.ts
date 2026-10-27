import type { TransactionNotifier } from '@/server/services/transactionNotification/transactionNotifier';
import { TransactionNotifierType } from '@/server/services/transactionNotification/transactionNotifier';
import { TelegramTransactionNotifier } from '@/server/services/transactionNotification/telegramTransactionNotifier';

const transactionNotifierFactory = {
  getNotifier(): TransactionNotifier {
    const notifierType =
      process.env.TRANSACTION_CREATED_NOTIFIER_TYPE || TransactionNotifierType.TELEGRAM;
    switch (notifierType) {
      case TransactionNotifierType.TELEGRAM:
      default:
        return new TelegramTransactionNotifier();
    }
  },
};

export default transactionNotifierFactory;
