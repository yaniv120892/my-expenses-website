import transactionService from '@/server/services/transactionService';
import userSettingsService from '@/server/services/userSettingsService';
import AIServiceFactory from '@/server/services/ai/aiServiceFactory';
import TransactionNotifierFactory from '@/server/services/transactionNotification/transactionNotifierFactory';
import { lazy } from '@/server/lib/lazy';
import logger from '@/server/logging/logger';

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
    for (const userId of users) {
      // Guarded per user so one failure cannot abort the run for the rest.
      try {
        const message = await this.getTodaySummaryMessage(userId);
        await notifier.sendDailySummary(message, userId);
      } catch (err) {
        logger.error({ err, userId }, 'Failed to send daily summary');
      }
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
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    return transactionService.getAllTransactions({
      startDate: startOfToday,
      endDate: endOfToday,
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
          `${t.category?.name || ''}, ${t.description || ''}, ${t.value || 0} ש״ח`,
      )
      .join('\n');
    return [
      '*ההוצאות של היום:*',
      list,
      '',
      `*סך הכל הוצאות:*\n${totalAmount} ש״ח\n`,
      '',
      `*סיכום:*\n${aiInsights}`,
    ].join('\n');
  }
}

export default new SummaryService();
