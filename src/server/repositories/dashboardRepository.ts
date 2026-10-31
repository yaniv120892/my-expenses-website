import prisma from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import { TransactionStatus, TransactionType } from '@/generated/prisma/client';
import type { MonthSummary, RecentTransaction } from '@/shared/types/dashboard';
import categoryRepository from '@/server/repositories/categoryRepository';
import { rollUpToNamedTopLevel } from '@/server/utils/categoryHierarchy';
import type { NamedCategoryTotal } from '@/server/utils/categoryHierarchy.types';

class DashboardRepository {
  private monthBounds(year: number, month: number) {
    return {
      startOfMonth: new Date(year, month - 1, 1),
      endOfMonth: new Date(year, month, 0, 23, 59, 59, 999),
    };
  }

  public async getMonthSummary(
    householdId: HouseholdId,
    year: number,
    month: number,
  ): Promise<MonthSummary> {
    const { startOfMonth, endOfMonth } = this.monthBounds(year, month);

    const groups = await prisma.transaction.groupBy({
      by: ['type'],
      _sum: { value: true },
      where: {
        householdId,
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
    householdId: HouseholdId,
    year: number,
    month: number,
    limit: number = 7,
  ): Promise<NamedCategoryTotal[]> {
    const { startOfMonth, endOfMonth } = this.monthBounds(year, month);

    const groups = await prisma.transaction.groupBy({
      by: ['categoryId'],
      _sum: { value: true },
      where: {
        householdId,
        status: TransactionStatus.APPROVED,
        type: TransactionType.EXPENSE,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      orderBy: { _sum: { value: 'desc' } },
    });

    const totals = groups.map((group) => ({
      categoryId: group.categoryId,
      amount: group._sum?.value ?? 0,
    }));
    const categories = await categoryRepository.getAllCategories();
    return rollUpToNamedTopLevel(totals, categories).slice(0, limit);
  }

  public async getRecentTransactions(
    householdId: HouseholdId,
    limit: number = 5,
  ): Promise<RecentTransaction[]> {
    const transactions = await prisma.transaction.findMany({
      where: { householdId, status: TransactionStatus.APPROVED },
      orderBy: { date: 'desc' },
      take: limit,
      include: { category: { select: { name: true } } },
    });

    return transactions.map((t) => ({
      id: t.id,
      description: t.description ?? '',
      value: t.value,
      date: t.date.toISOString(),
      type: t.type,
      categoryName: t.category?.name ?? 'Uncategorized',
    }));
  }
}

const dashboardRepository = new DashboardRepository();
export default dashboardRepository;
