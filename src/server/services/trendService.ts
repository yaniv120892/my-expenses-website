import { subMonths, format } from 'date-fns';
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
    try {
      const endDate = request.endDate || new Date();
      const startDate = request.startDate || subMonths(endDate, 6);

      const currentPeriodData = await transactionRepository.getTransactions({
        startDate,
        endDate,
        categoryId: request.categoryId,
        userId,
        status: TransactionStatus.APPROVED,
        page: 1,
        perPage: 1000,
        transactionType: request.transactionType || TransactionType.EXPENSE,
      });

      const previousPeriodLength = endDate.getTime() - startDate.getTime();
      const previousPeriodStartDate = new Date(
        startDate.getTime() - previousPeriodLength,
      );
      const previousPeriodData = await transactionRepository.getTransactions({
        startDate: previousPeriodStartDate,
        endDate: startDate,
        categoryId: request.categoryId,
        userId,
        status: TransactionStatus.APPROVED,
        page: 1,
        perPage: 1000,
        transactionType: request.transactionType || TransactionType.EXPENSE,
      });

      const points = this.groupTransactionsByPeriod(
        currentPeriodData,
        request.period,
      );
      const totalAmount = points.reduce((sum, point) => sum + point.amount, 0);

      const previousTotalAmount = previousPeriodData.reduce(
        (sum, transaction) => sum + transaction.value,
        0,
      );

      return {
        period: request.period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        points,
        totalAmount,
        percentageChange: this.calculatePercentageChange(
          totalAmount,
          previousTotalAmount,
        ),
        trend: this.calculateTrend(totalAmount, previousTotalAmount),
      };
    } catch (error) {
      logger.error({ err: error }, 'Error in getSpendingTrends');
      throw error;
    }
  }

  public async getCategorySpendingTrends(
    request: GetSpendingTrendsRequest,
    userId: string,
  ): Promise<CategorySpendingTrend[]> {
    try {
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

      const categoryTrends = new Map<string, CategoryTrendData>();
      topLevelCategories.forEach((cat) => {
        categoryTrends.set(cat.id, {
          points: [],
          totalAmount: 0,
          categoryName: cat.name,
          childCategories: new Set<string>(),
        });
      });

      for (const transaction of currentPeriodData) {
        if (!transaction.category) {
          logger.warn(`Transaction ${transaction.id} has no category`);
          continue;
        }

        const topLevelCategoryId = categoryParentMap.get(
          transaction.category.id,
        );
        if (!topLevelCategoryId) {
          logger.warn(
            `Top level category not found for transaction ${transaction.id}`,
          );
          continue;
        }

        const existing = categoryTrends.get(topLevelCategoryId);
        if (!existing) {
          continue;
        }

        existing.totalAmount += transaction.value;
        existing.childCategories.add(transaction.category.id);
      }

      const results: CategorySpendingTrend[] = [];
      for (const [categoryId, data] of categoryTrends.entries()) {
        if (data.childCategories.size === 0) {
          continue;
        }

        const categoryTransactions = this.filterTransactionsByCategory(
          currentPeriodData,
          data.childCategories,
        );

        const points = this.groupTransactionsByPeriod(
          categoryTransactions,
          request.period,
        ).map((point) => ({
          ...point,
          categoryId,
          categoryName: data.categoryName,
        }));

        const previousCategoryTransactions = this.filterTransactionsByCategory(
          previousPeriodData,
          data.childCategories,
        );

        const previousTotalAmount = this.calculateTotalAmount(
          previousCategoryTransactions,
        );

        results.push(
          this.createCategoryTrend(
            request,
            startDate,
            endDate,
            points,
            data,
            previousTotalAmount,
            categoryId,
          ),
        );
      }

      return results.sort((a, b) => b.totalAmount - a.totalAmount);
    } catch (error) {
      logger.error({ err: error }, 'Error in getCategorySpendingTrends');
      throw error;
    }
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
  ) {
    return transactionRepository.getTransactions({
      startDate,
      endDate,
      userId,
      status: TransactionStatus.APPROVED,
      page: 1,
      perPage: 1000,
      transactionType: transactionType || TransactionType.EXPENSE,
    });
  }

  private async fetchPreviousPeriodData(
    startDate: Date,
    endDate: Date,
    userId: string,
    transactionType?: TransactionType,
  ) {
    const previousPeriodLength = endDate.getTime() - startDate.getTime();
    const previousPeriodStartDate = new Date(
      startDate.getTime() - previousPeriodLength,
    );

    return this.fetchTransactionsForPeriod(
      previousPeriodStartDate,
      startDate,
      userId,
      transactionType,
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
    return {
      period: request.period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      points,
      totalAmount: data.totalAmount,
      percentageChange: this.calculatePercentageChange(
        data.totalAmount,
        previousTotalAmount,
      ),
      trend: this.calculateTrend(data.totalAmount, previousTotalAmount),
      categoryId,
      categoryName: data.categoryName,
    };
  }

  private calculateTrend(
    currentAmount: number,
    previousAmount: number,
  ): 'up' | 'down' | 'stable' {
    if (previousAmount === 0) return 'stable';
    const percentageChange =
      ((currentAmount - previousAmount) / previousAmount) * 100;
    if (percentageChange > 5) return 'up';
    if (percentageChange < -5) return 'down';
    return 'stable';
  }

  private calculatePercentageChange(
    currentAmount: number,
    previousAmount: number,
  ): number {
    if (previousAmount === 0) return 0;
    return ((currentAmount - previousAmount) / previousAmount) * 100;
  }

  private groupTransactionsByPeriod(
    transactions: Transaction[],
    period: string,
  ): TrendPoint[] {
    const groupedData = new Map<string, { amount: number; count: number }>();

    transactions.forEach((transaction) => {
      const date = new Date(transaction.date);
      let key: string;

      switch (period) {
        case 'daily':
          key = format(date, 'yyyy-MM-dd');
          break;
        case 'weekly':
          key = format(date, 'yyyy-ww'); // ISO week number
          break;
        case 'monthly':
          key = format(date, 'yyyy-MM');
          break;
        case 'yearly':
          key = format(date, 'yyyy');
          break;
        default:
          key = format(date, 'yyyy-MM-dd');
      }

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
