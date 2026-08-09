import transactionRepository from '@/server/repositories/transactionRepository';
import AIServiceFactory from '@/server/services/ai/aiServiceFactory';
import { Transaction } from '@/shared/types/transaction';
import { lazy } from '@/server/lib/lazy';

class SummaryService {
  private getAiService = lazy(() => AIServiceFactory.getAIService());

  public async getTodaySummary(userId: string) {
    const transactions = await this.getTodayTransactions(userId);
    const summary = this.buildSummary(transactions);
    const aiSummary = await this.getFunnyAiSummary(transactions);
    return { summary, aiSummary };
  }

  private getTodayDateRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  private async getTodayTransactions(userId: string) {
    const { start, end } = this.getTodayDateRange();
    return transactionRepository.getTransactions({
      startDate: start,
      endDate: end,
      page: 1,
      perPage: 100,
      status: 'APPROVED',
      userId,
    });
  }

  private buildSummary(transactions: Transaction[]) {
    const total = transactions.reduce((sum, t) => sum + t.value, 0);
    return `Today's expenses: ${total.toFixed(2)} NIS (${transactions.length} transactions)`;
  }

  private async getFunnyAiSummary(transactions: Transaction[]) {
    const descriptions = transactions
      .map((t) => `${t.description} (${t.category?.name})`)
      .join(', ');
    const prompt = `Write a short and funny summary about these expenses: ${descriptions}`;
    return this.getAiService().analyzeExpenses(prompt);
  }
}

export default new SummaryService();
