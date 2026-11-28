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
      logger.error({ err, ...logContext }, 'Failed to read the linked Telegram chat');
      throw new Error(
        `Failed to read the linked Telegram chat, userId: ${userId} error: ${JSON.stringify(err)}`,
        { cause: err },
      );
    }
    if (!chatId) {
      logger.warn(
        logContext,
        'Skipping transaction notification. Telegram chat ID is not set or user has disabled notifications',
      );
      return;
    }
    const messages = this.buildCreatedMessages(transactions);
    const errors = await telegramService.sendPlainMessagesWaitingOutRateLimits(chatId, messages);
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
        failures: errors.map((error) => this.describeFailure(error)),
      },
      'Failed to send transaction notification',
    );
    return new Error(
      `Failed to send transaction notification, userId: ${userId} transactionCount: ${transactions.length} firstTransactionId: ${transactions[0]?.id} failedMessages: ${errors.length}/${messageCount} error: ${JSON.stringify(firstError)}`,
      { cause: firstError },
    );
  }

  private describeFailure(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private buildCreatedMessages(transactions: Transaction[]): string[] {
    const title =
      transactions.length === 1
        ? 'Transaction Created'
        : `${transactions.length} Transactions Created`;
    const entryLimit = TELEGRAM_MESSAGE_MAX_LENGTH - title.length - PART_LABEL_RESERVED_LENGTH;
    const parts: string[] = [];
    let current = '';
    for (const transaction of transactions) {
      const entry = this.fitEntry({ entry: formatTransaction(transaction), entryLimit });
      const candidate = current ? `${current}\n${entry}` : entry;
      const startsNewPart = candidate.length > entryLimit;
      if (startsNewPart) {
        parts.push(current);
        current = entry;
        continue;
      }
      current = candidate;
    }
    parts.push(current);
    return parts.map(
      (part, index) => `${title}${this.partLabel({ index, partCount: parts.length })}\n${part}`,
    );
  }

  private fitEntry({ entry, entryLimit }: { entry: string; entryLimit: number }): string {
    if (entry.length <= entryLimit) {
      return entry;
    }
    return `${entry.slice(0, entryLimit - 1)}…`;
  }

  private partLabel({ index, partCount }: { index: number; partCount: number }): string {
    if (partCount === 1) {
      return '';
    }
    return ` (${index + 1}/${partCount})`;
  }

  private async getChatId(userId: string) {
    return userSettingsService.getLinkedTelegramChatId(userId);
  }
}
