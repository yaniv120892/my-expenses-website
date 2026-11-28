import type { TransactionNotifier } from '@/server/services/transactionNotification/transactionNotifier';
import type { Transaction } from '@/shared/types/transaction';
import { telegramService } from '@/server/services/telegramService';
import { formatTransaction } from '@/server/utils/transactionUtils';
import { logger } from '@/server/observability';
import userSettingsService from '@/server/services/userSettingsService';

const TELEGRAM_MESSAGE_MAX_LENGTH = 4096;
// Room for " (999/999)" plus the newline after the title.
const PART_LABEL_RESERVED_LENGTH = 11;

export class TelegramTransactionNotifier implements TransactionNotifier {
  public async notifyTransactionsCreated(
    transactions: Transaction[],
    userId: string,
  ): Promise<void> {
    const logContext = { userId, transactionCount: transactions.length };
    logger.debug(logContext, 'Start sending transaction notification to Telegram');
    let chatId: string | null;
    try {
      chatId = await this.getChatId(userId);
    } catch (err) {
      throw this.notificationFailure({ userId, transactions, errors: [err], messageCount: 0 });
    }
    if (!chatId) {
      logger.warn(
        logContext,
        'Skipping transaction notification. Telegram chat ID is not set or user has disabled notifications',
      );
      return;
    }
    const messages = this.buildCreatedMessages(transactions);
    const errors = await this.sendEachMessage(chatId, messages);
    if (errors.length > 0) {
      throw this.notificationFailure({
        userId,
        transactions,
        errors,
        messageCount: messages.length,
      });
    }
    logger.debug(logContext, 'Done sending transaction notification to Telegram');
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

  private notificationFailure({
    userId,
    transactions,
    errors,
    messageCount,
  }: {
    userId: string;
    transactions: Transaction[];
    errors: unknown[];
    messageCount: number;
  }): Error {
    const [firstError] = errors;
    logger.error(
      {
        err: firstError,
        userId,
        transactionCount: transactions.length,
        messageCount,
        failedMessageCount: errors.length,
      },
      'Failed to send transaction notification',
    );
    return new Error(
      `Failed to send transaction notification, userId: ${userId} transactionCount: ${transactions.length} firstTransactionId: ${transactions[0]?.id} failedMessages: ${errors.length}/${messageCount} error: ${JSON.stringify(firstError)}`,
      { cause: firstError },
    );
  }

  /** Every part is tried, so one refused part cannot silence the transactions in the others. */
  private async sendEachMessage(chatId: string, messages: string[]): Promise<unknown[]> {
    const failures: unknown[] = [];
    for (const message of messages) {
      try {
        await telegramService.sendPlainMessageWaitingOutRateLimits(chatId, message);
      } catch (err) {
        failures.push(err);
      }
    }
    return failures;
  }

  /** Splits between transactions, so no part passes Telegram's length cap. */
  private buildCreatedMessages(transactions: Transaction[]): string[] {
    const title =
      transactions.length === 1
        ? 'Transaction Created'
        : `${transactions.length} Transactions Created`;
    const entryLimit = TELEGRAM_MESSAGE_MAX_LENGTH - title.length - PART_LABEL_RESERVED_LENGTH;
    const parts: string[] = [];
    let current = '';
    for (const transaction of transactions) {
      const entry = formatTransaction(transaction);
      const candidate = current ? `${current}\n${entry}` : entry;
      const fitsCurrentPart = candidate.length <= entryLimit;
      if (fitsCurrentPart) {
        current = candidate;
        continue;
      }
      parts.push(current);
      current = entry;
    }
    parts.push(current);
    return parts.map((part, index) => `${title}${this.partLabel(index, parts.length)}\n${part}`);
  }

  private partLabel(index: number, partCount: number): string {
    if (partCount === 1) {
      return '';
    }
    return ` (${index + 1}/${partCount})`;
  }

  private async getChatId(userId: string) {
    return userSettingsService.getLinkedTelegramChatId(userId);
  }
}
