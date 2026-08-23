import prisma from '@/server/db/client';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { MonthSummary, RecentTransaction } from '@/shared/types/dashboard';
import { buildCategoryParentMap } from '@/server/utils/categoryHierarchy';

class DashboardRepository {
  private monthBounds(year: number, month: number) {
    return {
      startOfMonth: new Date(year, month - 1, 1),
      endOfMonth: new Date(year, month, 0, 23, 59, 59, 999),
    };
  }

  public async getMonthSummary(
    userId: string,
    year: number,
    month: number,
  ): Promise<MonthSummary> {
    const { startOfMonth, endOfMonth } = this.monthBounds(year, month);

    const groups = await prisma.transaction.groupBy({
      by: ['type'],
      _sum: { value: true },
      where: {
        userId,
        status: TransactionStatus.APPROVED,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    const incomeGroup = groups.find((g) => g.type === TransactionType.INCOME);
    const expenseGroup = groups.find((g) => g.type === TransactionType.EXPENSE);

    const totalIncome = incomeGroup?._sum?.value ?? 0;
    const totalExpense = expenseGroup?._sum?.value ?? 0;

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    return {
      month: monthStr,
      totalIncome,
      totalExpense,
      savings: totalIncome - totalExpense,
    };
  }

  public async getTopCategoriesForMonth(
    userId: string,
    year: number,
    month: number,
    limit: number = 7,
  ): Promise<{ categoryId: string; categoryName: string; amount: number }[]> {
    const { startOfMonth, endOfMonth } = this.monthBounds(year, month);

    const groups = await prisma.transaction.groupBy({
      by: ['categoryId'],
      _sum: { value: true },
      where: {
        userId,
        status: TransactionStatus.APPROVED,
        type: TransactionType.EXPENSE,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      orderBy: { _sum: { value: 'desc' } },
    });

    const parentMap = await buildCategoryParentMap();

    const parentAggregation = new Map<string, number>();
    for (const group of groups) {
      if (!group.categoryId) {
        continue;
      }
      const parentId = parentMap.get(group.categoryId) ?? group.categoryId;
      const current = parentAggregation.get(parentId) ?? 0;
      parentAggregation.set(parentId, current + (group._sum?.value ?? 0));
    }

    const sorted = Array.from(parentAggregation.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const categoryIds = sorted.map(([id]) => id);

    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));

    return sorted.map(([categoryId, amount]) => ({
      categoryId,
      categoryName: categoryNameMap.get(categoryId) ?? 'Unknown',
      amount,
    }));
  }

  public async getRecentTransactions(
    userId: string,
    limit: number = 5,
  ): Promise<RecentTransaction[]> {
    const transactions = await prisma.transaction.findMany({
      where: { userId, status: TransactionStatus.APPROVED },
      orderBy: { date: 'desc' },
      take: limit,
      include: { category: { select: { name: true } } },
    });

    return transactions.map((t) => ({
      id: t.id,
      description: t.description ?? '',
      value: t.value,
      date: t.date.toISOString(),
      type: t.type as 'INCOME' | 'EXPENSE',
      categoryName: t.category?.name ?? 'Uncategorized',
    }));
  }
}

export default new DashboardRepository();
