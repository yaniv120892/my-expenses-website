import transactionService from '@/server/services/transactionService';
import userSettingsService from '@/server/services/userSettingsService';
import AIServiceFactory from '@/server/services/ai/aiServiceFactory';
import TransactionNotifierFactory from '@/server/services/transactionNotification/transactionNotifierFactory';
import { lazy } from '@/server/lib/lazy';
import logger from '@/server/logging/logger';
import {
  formatSummaryMessage,
  SummaryTransaction,
} from '@/server/utils/summaryMessage';

class SummaryService {
  private getAiService = lazy(() => AIServiceFactory.getAIService());

  public async sendTodaySummaryToAllUsers(): Promise<void> {
    const notifier = TransactionNotifierFactory.getNotifier();
    const users = await userSettingsService.getUsersRequiredDailySummary();
    let failed = 0;
    for (const userId of users) {
      // Guarded per user so one failure cannot abort the run for the rest.
      try {
        const message = await this.getTodaySummaryMessage(userId);
        await notifier.sendDailySummary(message, userId);
      } catch (err) {
        failed += 1;
        logger.error({ err, userId }, 'Failed to send daily summary');
      }
    }

    logger.info(
      { total: users.length, succeeded: users.length - failed, failed },
      'Daily summary run finished',
    );
    if (failed > 0) {
      // Surface partial failure so cron monitoring sees it.
      throw new Error(
        `Daily summary failed for ${failed} of ${users.length} user(s)`,
      );
    }
  }

  private async getTodaySummaryMessage(userId: string): Promise<string> {
    const transactions = await this.getTodayTransactions(userId);
    if (transactions.length === 0) {
      return 'לא נוספו הוצאות היום.';
    }

    const transactionsTextForAiAnalyzer = transactions
      .map(
        (t) =>
          `description:${t.description}, category: ${t.category?.name}, amount: ${t.value}`,
      )
      .join('\n');
    const aiInsights = await this.getAiService().analyzeExpenses(
      transactionsTextForAiAnalyzer,
      'add a funny summary based on my expenses at the end',
    );
    const total = transactions.reduce((sum, t) => sum + t.value, 0);
    return formatSummaryMessage(transactions, total, aiInsights);
  }

  private async getTodayTransactions(
    userId: string,
  ): Promise<SummaryTransaction[]> {
    // One normalizer owns both bounds: the repository floors startDate to
    // startOfDay and widens endDate to endOfDay.
    const today = new Date();
    return transactionService.getAllTransactions({
      startDate: today,
      endDate: today,
      userId,
    });
  }
}

export default new SummaryService();
