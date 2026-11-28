import type { TransactionNotifier } from '@/server/services/transactionNotification/transactionNotifier';
import type { Transaction } from '@/shared/types/transaction';
import { telegramService } from '@/server/services/telegramService';
import { formatTransaction } from '@/server/utils/transactionUtils';
import { logger } from '@/server/observability';
import userSettingsService from '@/server/services/userSettingsService';

const TELEGRAM_MESSAGE_MAX_LENGTH = 4096;

export class TelegramTransactionNotifier implements TransactionNotifier {
  public async notifyTransactionsCreated(
    transactions: Transaction[],
    userId: string,
  ): Promise<void> {
    const logContext = { userId, transactionCount: transactions.length };
    try {
      logger.debug(logContext, 'Start sending transaction notification to Telegram');
      const chatId = await this.getChatId(userId);
      if (!chatId) {
        logger.warn(
          logContext,
          'Skipping transaction notification. Telegram chat ID is not set or user has disabled notifications',
        );
        return;
      }
      for (const message of this.buildCreatedMessages(transactions)) {
        await telegramService.sendPlainMessage(chatId, message);
      }
      logger.debug(logContext, 'Done sending transaction notification to Telegram');
    } catch (err) {
      logger.error({ err, ...logContext }, 'Failed to send transaction notification');
      throw new Error(
        `Failed to send transaction notification, userId: ${userId} transactionCount: ${transactions.length} firstTransactionId: ${transactions[0]?.id} error: ${JSON.stringify(err)}`,
        { cause: err },
      );
    }
  }

  public async sendDailySummary(dailySummary: string, userId: string): Promise<void> {
    try {
      logger.debug({ userId }, 'Start sending daily summary to Telegram');
      const chatId = await this.getChatId(userId);
      if (!chatId) {
        logger.warn(
          { userId },
          'Skip sending daily summary, Telegram chat ID is not set or user has disabled notifications',
        );
        return;
      }
      await telegramService.sendMessage(chatId, dailySummary);
      logger.debug({ userId }, 'Done sending daily summary to Telegram');
    } catch (err) {
      logger.error({ err, userId }, 'Failed to send daily summary');
      throw new Error(
        `Failed to send daily summary, userId: ${userId} error: ${JSON.stringify(err)}`,
        { cause: err },
      );
    }
  }

  /** Splits between transactions, so no message passes Telegram's length cap. */
  private buildCreatedMessages(transactions: Transaction[]): string[] {
    const header =
      transactions.length === 1
        ? 'Transaction Created'
        : `${transactions.length} Transactions Created`;
    const messages: string[] = [];
    let current = header;
    for (const transaction of transactions) {
      const entry = formatTransaction(transaction);
      const candidate = `${current}\n${entry}`;
      const fitsCurrentMessage = candidate.length <= TELEGRAM_MESSAGE_MAX_LENGTH;
      if (fitsCurrentMessage) {
        current = candidate;
        continue;
      }
      messages.push(current);
      current = entry;
    }
    messages.push(current);
    return messages;
  }

  private async getChatId(userId: string) {
    return userSettingsService.getLinkedTelegramChatId(userId);
  }
}
