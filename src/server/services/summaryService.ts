import transactionService from '@/server/services/transactionService';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import userSettingsService from '@/server/services/userSettingsService';
import userRepository from '@/server/repositories/userRepository';
import aiServiceFactory from '@/server/services/ai/aiServiceFactory';
import transactionNotifierFactory from '@/server/services/transactionNotification/transactionNotifierFactory';
import { lazy } from '@/server/lib/lazy';
import { logger } from '@/server/observability';
import { TransactionType } from '@/generated/prisma/client';
import type { SummaryTransaction } from '@/server/utils/summaryMessage';
import { formatSummaryMessage } from '@/server/utils/summaryMessage';

class SummaryService {
  private getAiService = lazy(() => aiServiceFactory.getAIService());

  public async sendTodaySummaryToAllUsers(): Promise<void> {
    const notifier = transactionNotifierFactory.getNotifier();
    const users = await userSettingsService.getUsersRequiredDailySummary();
    let failed = 0;
    for (const userId of users) {
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
      throw new Error(`Daily summary failed for ${failed} of ${users.length} user(s)`);
    }
  }

  private async getTodaySummaryMessage(userId: string): Promise<string> {
    const householdId = await userRepository.findHouseholdId(userId);
    if (!householdId) {
      throw new Error(`No household for user ${userId}`);
    }
    const transactions = await this.getTodayTransactions(householdId);
    if (transactions.length === 0) {
      return 'לא נוספו הוצאות היום.';
    }

    const transactionsTextForAiAnalyzer = transactions
      .map((t) => `description:${t.description}, category: ${t.category?.name}, amount: ${t.value}`)
      .join('\n');
    const aiInsights = await this.getAiService().analyzeExpenses(
      transactionsTextForAiAnalyzer,
      'add a funny summary based on my expenses at the end',
    );
    const total = transactions.reduce((sum, t) => sum + t.value, 0);
    return formatSummaryMessage(transactions, total, aiInsights);
  }

  private async getTodayTransactions(householdId: HouseholdId): Promise<SummaryTransaction[]> {
    // One normalizer owns both bounds: the repository floors startDate to
    // startOfDay and widens endDate to endOfDay.
    const today = new Date();
    return transactionService.getAllTransactions(householdId, {
      startDate: today,
      endDate: today,
      transactionType: TransactionType.EXPENSE,
    });
  }
}

const summaryService = new SummaryService();
export default summaryService;
