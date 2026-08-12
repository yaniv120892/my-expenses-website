import {
  TransactionType,
  TransactionStatus,
  Transaction as PrismaTransaction,
  TransactionFile as PrismaTransactionFile,
  Category as PrismaCategory,
} from '@prisma/client';
import prisma from '@/server/db/client';
import {
  TransactionFilters,
  Transaction,
  TransactionSummaryFilters,
  TransactionSummary,
} from '@/shared/types/transaction';
import {
  CreateTransactionDbModel,
  UpdateTransactionDbModel,
} from '@/server/repositories/types';
import { endOfDay, startOfDay } from 'date-fns';
import Fuse from 'fuse.js';

// The Prisma model plus its joined category, and files only when the caller
// included them.
type TransactionRow = PrismaTransaction & {
  category: PrismaCategory;
  files?: PrismaTransactionFile[];
};

// Fuzzy search ranks candidates in memory, so it needs a bounded window of
// recent transactions rather than the whole table.
const SMART_SEARCH_CANDIDATE_LIMIT = 1000;

class TransactionRepository {
  public async getTransactionsSummary(
    filters: TransactionSummaryFilters,
  ): Promise<TransactionSummary> {
    const { startDate, endDate } = this.getNormalizedDateRange(
      filters.startDate,
      filters.endDate,
    );
    const groups = await prisma.transaction.groupBy({
      by: ['type'],
      _sum: { value: true },
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        categoryId: filters.categoryId,
        type: filters.transactionType,
        status: filters.status || TransactionStatus.APPROVED,
        userId: filters.userId,
      },
    });

    const sumOf = (type: TransactionType) =>
      groups.find((group) => group.type === type)?._sum.value ?? 0;

    return {
      totalIncome: sumOf(TransactionType.INCOME),
      totalExpense: sumOf(TransactionType.EXPENSE),
    };
  }

  public async createTransaction(
    data: CreateTransactionDbModel,
  ): Promise<string> {
    const transaction = await prisma.transaction.create({
      data: {
        description: data.description,
        value: data.value,
        date: data.date,
        categoryId: data.categoryId,
        type: data.type,
        status: data.status || TransactionStatus.APPROVED,
        userId: data.userId,
      },
      include: { category: true },
    });

    return transaction.id;
  }

  public async getTransactions(
    filters: TransactionFilters,
  ): Promise<Transaction[]> {
    const { startDate, endDate } = this.getNormalizedDateRange(
      filters.startDate,
      filters.endDate,
    );

    const searchTerm = filters.searchTerm;
    if (!searchTerm) {
      return this.getTransactionsPage(filters, startDate, endDate);
    }
    if (filters.smartSearch === false) {
      return this.useStrictSearch(filters, searchTerm, startDate, endDate);
    }
    return this.useSmartSearch(filters, searchTerm, startDate, endDate);
  }

  public async getPendingTransactions(userId: string): Promise<Transaction[]> {
    const transactions = await prisma.transaction.findMany({
      where: { status: TransactionStatus.PENDING_APPROVAL, userId: userId },
      include: { category: true },
      orderBy: { date: 'desc' },
    });
    return transactions.map(this.mapToDomain);
  }

  public async updateTransactionStatus(
    id: string,
    status: TransactionStatus,
    userId: string,
  ): Promise<string> {
    const transaction = await prisma.transaction.update({
      where: { id, userId },
      data: { status },
    });
    return transaction.id;
  }

  public async getTransactionItem(
    transactionId: string,
    userId: string,
  ): Promise<Transaction | null> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId, userId },
      include: {
        category: true,
        files: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return transaction ? this.mapToDomain(transaction) : null;
  }

  private mapToDomain(transaction: TransactionRow): Transaction {
    return {
      id: transaction.id,
      description: transaction.description,
      value: transaction.value,
      date: transaction.date,
      type: transaction.type,
      status: transaction.status,
      category: {
        id: transaction.category.id,
        name: transaction.category.name,
      },
      files:
        transaction.files?.map((file) => ({
          id: file.id,
          transactionId: file.transactionId,
          fileName: file.fileName,
          fileKey: file.fileKey,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          status: file.status,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        })) || [],
    };
  }

  public async updateTransaction(
    id: string,
    data: UpdateTransactionDbModel,
    userId: string,
  ): Promise<string> {
    const transaction = await prisma.transaction.update({
      where: { id, userId },
      data: {
        description: data.description,
        value: data.value,
        date: data.date,
        categoryId: data.categoryId,
        type: data.type,
        status: data.status,
      },
    });
    return transaction.id;
  }

  public async deleteTransaction(id: string, userId: string): Promise<void> {
    await prisma.transaction.delete({
      where: { id, userId },
    });
  }

  /**
   * Per-category, per-type, per-day sums. Aggregating in Postgres keeps the
   * comparison report to one round trip; the caller folds the day rows into
   * whatever period buckets it needs.
   */
  public async getCategoryPeriodTotals(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
    categoryIds: string[];
    transactionType?: TransactionType;
  }): Promise<
    {
      categoryId: string;
      type: TransactionType;
      date: Date;
      sum: number;
      count: number;
    }[]
  > {
    const { startDate, endDate } = this.getNormalizedDateRange(
      params.startDate,
      params.endDate,
    );

    const groups = await prisma.transaction.groupBy({
      by: ['categoryId', 'type', 'date'],
      _sum: { value: true },
      _count: { _all: true },
      where: {
        userId: params.userId,
        status: TransactionStatus.APPROVED,
        categoryId: { in: params.categoryIds },
        type: params.transactionType,
        date: { gte: startDate, lte: endDate },
      },
    });

    return groups.map((group) => ({
      categoryId: group.categoryId,
      type: group.type,
      date: group.date,
      sum: group._sum?.value ?? 0,
      count: group._count?._all ?? 0,
    }));
  }

  private getNormalizedDateRange(startDate?: Date, endDate?: Date) {
    const normalizedStartDate = startDate
      ? startOfDay(new Date(startDate))
      : undefined;
    const normalizedEndDate = endDate ? endOfDay(new Date(endDate)) : undefined;
    return { startDate: normalizedStartDate, endDate: normalizedEndDate };
  }

  public async findPotentialMatches(
    userId: string,
    date: Date,
    value: number,
    tolerance: number = 2,
    dayRange: number = 2,
  ): Promise<Transaction[]> {
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - dayRange);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + dayRange);

    const potentialTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        value: {
          gte: value - tolerance,
          lte: value + tolerance,
        },
        status: {
          in: [TransactionStatus.APPROVED, TransactionStatus.PENDING_APPROVAL],
        },
      },
      orderBy: { status: 'desc' },
      include: { category: true },
    });

    return potentialTransactions.map(this.mapToDomain);
  }

  private buildListWhere(
    filters: TransactionFilters,
    startDate: Date | undefined,
    endDate: Date | undefined,
  ) {
    return {
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.transactionType ? { type: filters.transactionType } : {}),
      status: filters.status || TransactionStatus.APPROVED,
      userId: filters.userId,
    };
  }

  private async getTransactionsPage(
    filters: TransactionFilters,
    startDate: Date | undefined,
    endDate: Date | undefined,
  ): Promise<Transaction[]> {
    const transactions = await prisma.transaction.findMany({
      where: this.buildListWhere(filters, startDate, endDate),
      include: { category: true },
      orderBy: { date: 'desc' },
      skip: (filters.page - 1) * filters.perPage,
      take: filters.perPage,
    });
    return transactions.map(this.mapToDomain);
  }

  private async useStrictSearch(
    filters: TransactionFilters,
    searchTerm: string,
    startDate: Date | undefined,
    endDate: Date | undefined,
  ): Promise<Transaction[]> {
    const transactions = await prisma.transaction.findMany({
      where: {
        ...this.buildListWhere(filters, startDate, endDate),
        description: { contains: searchTerm },
      },
      include: { category: true },
      orderBy: { date: 'desc' },
      skip: (filters.page - 1) * filters.perPage,
      take: filters.perPage,
    });
    return transactions.map(this.mapToDomain);
  }

  private async useSmartSearch(
    filters: TransactionFilters,
    searchTerm: string,
    startDate: Date | undefined,
    endDate: Date | undefined,
  ): Promise<Transaction[]> {
    const candidates = await prisma.transaction.findMany({
      where: this.buildListWhere(filters, startDate, endDate),
      include: { category: true },
      orderBy: { date: 'desc' },
      take: SMART_SEARCH_CANDIDATE_LIMIT,
    });

    const fuse = new Fuse(candidates, {
      keys: ['description'],
      threshold: 0.8,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
    const matches = fuse.search(searchTerm).map((result) => result.item);

    const paginated = matches.slice(
      (filters.page - 1) * filters.perPage,
      filters.page * filters.perPage,
    );
    return paginated.map(this.mapToDomain);
  }
}

export default new TransactionRepository();
