import { subDays, subMonths } from 'date-fns';
import {
  GetSpendingTrendsRequest,
  SpendingTrend,
  CategorySpendingTrend,
  TrendPoint,
  CategoryTrendPoint,
} from '@/shared/types/trends';
import logger from '@/server/logging/logger';
import transactionRepository from '@/server/repositories/transactionRepository';
import categoryRepository from '@/server/repositories/categoryRepository';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { buildCategoryParentMap } from '@/server/utils/categoryHierarchy';
import { Transaction } from '@/shared/types/transaction';
import { classifyTrend } from '@/server/utils/trendMath';
import { bucketKeyFor } from '@/shared/periodBuckets';

interface CategoryTrendData {
  points: CategoryTrendPoint[];
  totalAmount: number;
  categoryName: string;
  childCategories: Set<string>;
}

class TrendService {
  public async getSpendingTrends(
    request: GetSpendingTrendsRequest,
    userId: string,
  ): Promise<SpendingTrend> {
    const { startDate, endDate } = this.getDateRange(request);

    const [currentPeriodData, previousPeriodData] = await Promise.all([
      this.fetchTransactionsForPeriod(
        startDate,
        endDate,
        userId,
        request.transactionType,
        request.categoryId,
      ),
      this.fetchPreviousPeriodData(
        startDate,
        endDate,
        userId,
        request.transactionType,
        request.categoryId,
      ),
    ]);

    const points = this.groupTransactionsByPeriod(
      currentPeriodData,
      request.period,
    );
    const totalAmount = points.reduce((sum, point) => sum + point.amount, 0);
    const previousTotalAmount = this.calculateTotalAmount(previousPeriodData);
    const { percentage, trend } = classifyTrend(
      totalAmount,
      previousTotalAmount,
    );

    return {
      period: request.period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      points,
      totalAmount,
      percentageChange: percentage,
      trend,
    };
  }

  public async getCategorySpendingTrends(
    request: GetSpendingTrendsRequest,
    userId: string,
  ): Promise<CategorySpendingTrend[]> {
    const { startDate, endDate } = this.getDateRange(request);

    const [
      currentPeriodData,
      previousPeriodData,
      topLevelCategories,
      categoryParentMap,
    ] = await Promise.all([
      this.fetchTransactionsForPeriod(
        startDate,
        endDate,
        userId,
        request.transactionType,
      ),
      this.fetchPreviousPeriodData(
        startDate,
        endDate,
        userId,
        request.transactionType,
      ),
      categoryRepository.getTopLevelCategories(),
      buildCategoryParentMap(),
    ]);

    const categoryTrends = this.seedCategoryTrends(topLevelCategories);
    this.accumulateCategoryTotals(
      categoryTrends,
      currentPeriodData,
      categoryParentMap,
    );

    const results: CategorySpendingTrend[] = [];
    for (const [categoryId, data] of categoryTrends.entries()) {
      // A top-level category no transaction rolled up into has nothing to plot.
      if (data.childCategories.size === 0) {
        continue;
      }

      results.push(
        this.buildCategoryTrend(
          request,
          startDate,
          endDate,
          categoryId,
          data,
          currentPeriodData,
          previousPeriodData,
        ),
      );
    }

    return results.sort((a, b) => b.totalAmount - a.totalAmount);
  }

  private seedCategoryTrends(
    topLevelCategories: { id: string; name: string }[],
  ): Map<string, CategoryTrendData> {
    const categoryTrends = new Map<string, CategoryTrendData>();
    for (const category of topLevelCategories) {
      categoryTrends.set(category.id, {
        points: [],
        totalAmount: 0,
        categoryName: category.name,
        childCategories: new Set<string>(),
      });
    }
    return categoryTrends;
  }

  /** Rolls each transaction up into its top-level ancestor's running total. */
  private accumulateCategoryTotals(
    categoryTrends: Map<string, CategoryTrendData>,
    transactions: Transaction[],
    categoryParentMap: Map<string, string>,
  ): void {
    for (const transaction of transactions) {
      if (!transaction.category) {
        logger.warn(`Transaction ${transaction.id} has no category`);
        continue;
      }

      const topLevelCategoryId = categoryParentMap.get(transaction.category.id);
      if (!topLevelCategoryId) {
        logger.warn(
          `Top level category not found for transaction ${transaction.id}`,
        );
        continue;
      }

      const trend = categoryTrends.get(topLevelCategoryId);
      if (!trend) {
        continue;
      }

      trend.totalAmount += transaction.value;
      trend.childCategories.add(transaction.category.id);
    }
  }

  private buildCategoryTrend(
    request: GetSpendingTrendsRequest,
    startDate: Date,
    endDate: Date,
    categoryId: string,
    data: CategoryTrendData,
    currentPeriodData: Transaction[],
    previousPeriodData: Transaction[],
  ): CategorySpendingTrend {
    const points = this.groupTransactionsByPeriod(
      this.filterTransactionsByCategory(
        currentPeriodData,
        data.childCategories,
      ),
      request.period,
    ).map((point) => ({
      ...point,
      categoryId,
      categoryName: data.categoryName,
    }));

    const previousTotalAmount = this.calculateTotalAmount(
      this.filterTransactionsByCategory(
        previousPeriodData,
        data.childCategories,
      ),
    );

    return this.createCategoryTrend(
      request,
      startDate,
      endDate,
      points,
      data,
      previousTotalAmount,
      categoryId,
    );
  }

  private getDateRange(request: GetSpendingTrendsRequest) {
    const endDate = request.endDate || new Date();
    const startDate = request.startDate || subMonths(endDate, 6);
    return { startDate, endDate };
  }

  private async fetchTransactionsForPeriod(
    startDate: Date,
    endDate: Date,
    userId: string,
    transactionType?: TransactionType,
    categoryId?: string,
  ) {
    // Paginated to exhaustion — a single capped page would silently truncate
    // trend totals for heavy months.
    const transactions: Transaction[] = [];
    const perPage = 1000;
    let page = 1;
    for (;;) {
      const batch = await transactionRepository.getTransactions({
        startDate,
        endDate,
        categoryId,
        userId,
        status: TransactionStatus.APPROVED,
        page,
        perPage,
        transactionType: transactionType || TransactionType.EXPENSE,
      });
      transactions.push(...batch);
      if (batch.length < perPage) {
        return transactions;
      }
      page += 1;
    }
  }

  private async fetchPreviousPeriodData(
    startDate: Date,
    endDate: Date,
    userId: string,
    transactionType?: TransactionType,
    categoryId?: string,
  ) {
    const previousPeriodLength = endDate.getTime() - startDate.getTime();
    const previousPeriodStartDate = new Date(
      startDate.getTime() - previousPeriodLength,
    );
    // Ends the day before the current period starts — the repository widens
    // endDate to endOfDay, so passing startDate itself double-counts that day.
    const previousPeriodEndDate = subDays(startDate, 1);

    return this.fetchTransactionsForPeriod(
      previousPeriodStartDate,
      previousPeriodEndDate,
      userId,
      transactionType,
      categoryId,
    );
  }

  private filterTransactionsByCategory(
    transactions: Transaction[],
    categoryIds: Set<string>,
  ) {
    return transactions.filter(
      (t) => t.category && categoryIds.has(t.category.id),
    );
  }

  private calculateTotalAmount(transactions: Transaction[]): number {
    return transactions.reduce(
      (sum, transaction) => sum + transaction.value,
      0,
    );
  }

  private createCategoryTrend(
    request: GetSpendingTrendsRequest,
    startDate: Date,
    endDate: Date,
    points: CategoryTrendPoint[],
    data: CategoryTrendData,
    previousTotalAmount: number,
    categoryId: string,
  ): CategorySpendingTrend {
    const { percentage, trend } = classifyTrend(
      data.totalAmount,
      previousTotalAmount,
    );

    return {
      period: request.period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      points,
      totalAmount: data.totalAmount,
      percentageChange: percentage,
      trend,
      categoryId,
      categoryName: data.categoryName,
    };
  }

  private groupTransactionsByPeriod(
    transactions: Transaction[],
    period: string,
  ): TrendPoint[] {
    const groupedData = new Map<string, { amount: number; count: number }>();

    transactions.forEach((transaction) => {
      const date = new Date(transaction.date);
      const key = bucketKeyFor(date, period);

      const existing = groupedData.get(key) || { amount: 0, count: 0 };
      groupedData.set(key, {
        amount: existing.amount + transaction.value,
        count: existing.count + 1,
      });
    });

    return Array.from(groupedData.entries()).map(([date, data]) => ({
      date,
      amount: data.amount,
      count: data.count,
    }));
  }
}

export default new TrendService();
