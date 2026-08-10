import { TransactionNotifier } from '@/server/services/transactionNotification/transactionNotifier';
import { Transaction } from '@/shared/types/transaction';
import { telegramService } from '@/server/services/telegramService';
import { formatTransaction } from '@/server/utils/transactionUtils';
import logger from '@/server/logging/logger';
import userSettingsService from '@/server/services/userSettingsService';

export class TelegramTransactionNotifier implements TransactionNotifier {
  public async notifyTransactionCreated(
    transaction: Transaction,
    userId: string,
  ): Promise<void> {
    try {
      logger.debug(
        { userId, transactionId: transaction.id },
        'Start sending transaction notification to Telegram',
      );
      const chatId = await this.getChatId(userId);
      if (!chatId) {
        logger.warn(
          { userId, transactionId: transaction.id },
          'Skipping transaction notification. Telegram chat ID is not set or user has disabled notifications',
        );
        return;
      }
      const message = `Transaction Created\n${formatTransaction(transaction)}`;
      await telegramService.sendMessage(chatId, message);
      logger.debug(
        { userId, transactionId: transaction.id },
        'Done sending transaction notification to Telegram',
      );
    } catch (err) {
      logger.error(
        { err, userId, transactionId: transaction.id },
        'Failed to send transaction notification',
      );
      throw new Error(
        `Failed to send transaction notification, userId: ${userId} transactionId: ${transaction.id} error: ${JSON.stringify(
          err,
        )}`,
      );
    }
  }

  public async sendDailySummary(
    dailySummary: string,
    userId: string,
  ): Promise<void> {
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
      );
    }
  }

  private async getChatId(userId: string) {
    const userChatId = await userSettingsService.getUserSettings(userId);
    return userChatId?.provider?.enabled
      ? userChatId.provider.telegramChatId
      : null;
  }
}
