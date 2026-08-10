import AIServiceFactory from '@/server/services/ai/aiServiceFactory';
import dashboardRepository from '@/server/repositories/dashboardRepository';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';
import {
  DashboardResponse,
  DashboardInsightsResponse,
  MonthComparison,
  MonthSummary,
  PercentageChange,
  TopCategory,
} from '@/shared/types/dashboard';
import logger from '@/server/logging/logger';
import { getValue, setValue } from '@/server/redis';
import { lazy } from '@/server/lib/lazy';
import { classifyTrend } from '@/server/utils/trendMath';

class DashboardService {
  private getAiService = lazy(() => AIServiceFactory.getAIService());

  public async getDashboard(userId: string): Promise<DashboardResponse> {
    const { currentYear, currentMonth, prevYear, prevMonth } =
      this.getMonthCursors();

    const [
      currentMonthSummary,
      previousMonthSummary,
      topCategoriesCurrent,
      topCategoriesPrevious,
      recentTransactions,
      subscriptionSnapshot,
    ] = await Promise.all([
      dashboardRepository.getMonthSummary(userId, currentYear, currentMonth),
      dashboardRepository.getMonthSummary(userId, prevYear, prevMonth),
      dashboardRepository.getTopCategoriesForMonth(
        userId,
        currentYear,
        currentMonth,
        7,
      ),
      dashboardRepository.getTopCategoriesForMonth(
        userId,
        prevYear,
        prevMonth,
        7,
      ),
      dashboardRepository.getRecentTransactions(userId, 5),
      subscriptionDetectionService.getDashboardSnapshot(userId),
    ]);

    const monthComparison = this.buildMonthComparison(
      currentMonthSummary,
      previousMonthSummary,
    );
    const topCategories = this.mergeTopCategories(
      topCategoriesCurrent,
      topCategoriesPrevious,
      currentMonthSummary.totalExpense,
    );

    return {
      monthComparison,
      topCategories,
      recentTransactions,
      subscriptions: subscriptionSnapshot,
    };
  }

  public async getInsights(
    userId: string,
  ): Promise<DashboardInsightsResponse | null> {
    const now = new Date();
    const cacheKey = `dashboard-insights:${userId}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      const cached = await getValue<DashboardInsightsResponse | string>(
        cacheKey,
      );
      if (cached) {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to read dashboard insights cache');
    }

    const { currentYear, currentMonth, prevYear, prevMonth } =
      this.getMonthCursors(now);

    try {
      const [currentMonthSummary, previousMonthSummary, topCategories] =
        await Promise.all([
          dashboardRepository.getMonthSummary(
            userId,
            currentYear,
            currentMonth,
          ),
          dashboardRepository.getMonthSummary(userId, prevYear, prevMonth),
          dashboardRepository.getTopCategoriesForMonth(
            userId,
            currentYear,
            currentMonth,
            7,
          ),
        ]);

      const result = await this.generateAiInsights(
        currentMonthSummary,
        topCategories,
        previousMonthSummary,
      );
      if (result) {
        try {
          await setValue(cacheKey, JSON.stringify(result), 3600); // 1 hour TTL
        } catch (cacheError) {
          logger.error(
            { err: cacheError },
            'Failed to cache dashboard insights',
          );
        }
      }
      return result;
    } catch (error) {
      logger.error({ err: error }, 'Failed to generate dashboard insights');
      return null;
    }
  }

  private getMonthCursors(now: Date = new Date()) {
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      prevYear: prevDate.getFullYear(),
      prevMonth: prevDate.getMonth() + 1,
    };
  }

  private calculatePercentageChange(
    current: number,
    previous: number,
  ): PercentageChange {
    return { amount: current - previous, ...classifyTrend(current, previous) };
  }

  private buildMonthComparison(
    current: MonthSummary,
    previous: MonthSummary,
  ): MonthComparison {
    return {
      currentMonth: current,
      previousMonth: previous,
      incomeChange: this.calculatePercentageChange(
        current.totalIncome,
        previous.totalIncome,
      ),
      expenseChange: this.calculatePercentageChange(
        current.totalExpense,
        previous.totalExpense,
      ),
      savingsChange: this.calculatePercentageChange(
        current.savings,
        previous.savings,
      ),
    };
  }

  private mergeTopCategories(
    current: { categoryId: string; categoryName: string; amount: number }[],
    previous: { categoryId: string; categoryName: string; amount: number }[],
    totalExpense: number,
  ): TopCategory[] {
    const previousMap = new Map(previous.map((c) => [c.categoryId, c.amount]));

    return current.map((cat) => {
      const previousMonthAmount = previousMap.get(cat.categoryId) ?? 0;
      const percentage =
        totalExpense === 0 ? 0 : (cat.amount / totalExpense) * 100;
      const change = this.calculatePercentageChange(
        cat.amount,
        previousMonthAmount,
      );

      return {
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        amount: cat.amount,
        percentage,
        previousMonthAmount,
        change,
      };
    });
  }

  private async generateAiInsights(
    currentMonth: MonthSummary,
    topCategories: {
      categoryId: string;
      categoryName: string;
      amount: number;
    }[],
    previousMonth: MonthSummary,
  ): Promise<DashboardInsightsResponse | null> {
    try {
      const categoriesSummary = topCategories
        .map((c) => `${c.categoryName}: ${c.amount.toFixed(2)}`)
        .join(', ');

      const prompt = `Analyze these monthly expenses and provide insights.
Current month (${currentMonth.month}): Income ${currentMonth.totalIncome.toFixed(2)}, Expenses ${currentMonth.totalExpense.toFixed(2)}, Savings ${currentMonth.savings.toFixed(2)}.
Previous month (${previousMonth.month}): Income ${previousMonth.totalIncome.toFixed(2)}, Expenses ${previousMonth.totalExpense.toFixed(2)}, Savings ${previousMonth.savings.toFixed(2)}.
Top spending categories this month: ${categoriesSummary}.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{"unusualSpending": ["insight 1", "insight 2"], "summary": "A brief overall summary"}`;

      const response = await this.getAiService().analyzeExpenses(prompt);

      const cleaned = response
        .replace(/```json?\n?/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(cleaned) as DashboardInsightsResponse;
    } catch (error) {
      logger.error({ err: error }, 'Failed to parse AI insights response');
      return null;
    }
  }
}

export default new DashboardService();
