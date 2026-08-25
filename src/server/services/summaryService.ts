import transactionService from '@/server/services/transactionService';
import userSettingsService from '@/server/services/userSettingsService';
import AIServiceFactory from '@/server/services/ai/aiServiceFactory';
import TransactionNotifierFactory from '@/server/services/transactionNotification/transactionNotifierFactory';
import { lazy } from '@/server/lib/lazy';
import logger from '@/server/logging/logger';
import { formatCurrencyPlain } from '@/utils/format';
import { escapeMarkdown } from '@/server/services/telegramService';

interface SummaryTransaction {
  description?: string | null;
  value: number;
  category?: { name: string } | null;
}

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
    return this.formatSummaryMessage(transactions, total, aiInsights);
  }

  private async getTodayTransactions(
    userId: string,
  ): Promise<SummaryTransaction[]> {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    // The repository widens endDate to endOfDay, so `now` covers exactly
    // today; the previous day+1 bound made the "today" summary span tomorrow
    // as well.
    return transactionService.getAllTransactions({
      startDate: startOfToday,
      endDate: now,
      userId,
    });
  }

  private formatSummaryMessage(
    transactions: SummaryTransaction[],
    totalAmount: number,
    aiInsights: string,
  ): string {
    const list = transactions
      .map(
        (t) =>
          `${escapeMarkdown(t.category?.name || '')}, ${escapeMarkdown(t.description || '')}, ${formatCurrencyPlain(t.value || 0)}`,
      )
      .join('\n');
    return [
      '*ההוצאות של היום:*',
      list,
      '',
      `*סך הכל הוצאות:*\n${formatCurrencyPlain(totalAmount)}\n`,
      '',
      `*סיכום:*\n${aiInsights}`,
    ].join('\n');
  }
}

export default new SummaryService();
