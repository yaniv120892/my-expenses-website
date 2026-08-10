import {
  TransactionNotifierType,
  TransactionNotifier,
} from '@/server/services/transactionNotification/transactionNotifier';
import { TelegramTransactionNotifier } from '@/server/services/transactionNotification/telegramTransactionNotifier';

class TransactionNotifierFactory {
  static getNotifier(): TransactionNotifier {
    const notifierType =
      process.env.TRANSACTION_CREATED_NOTIFIER_TYPE ||
      TransactionNotifierType.TELEGRAM;
    switch (notifierType) {
      case TransactionNotifierType.TELEGRAM:
      default:
        return new TelegramTransactionNotifier();
    }
  }
}

export default TransactionNotifierFactory;
