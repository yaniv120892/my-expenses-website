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
  TransactionListFilters,
  TransactionListPage,
  TransactionSummaryFilters,
  TransactionSummary,
} from '@/shared/types/transaction';
import {
  CreateTransactionDbModel,
  UpdateTransactionDbModel,
} from '@/server/repositories/types';
import { endOfDay, startOfDay } from 'date-fns';
import { HttpError } from '@/server/http/errors';

// Prisma raises P2025 when an update/delete matches no row — here that means
// the transaction does not exist or belongs to another user.
function throwNotFoundOnMissingRow(err: unknown): never {
  if ((err as { code?: string })?.code === 'P2025') {
    throw new HttpError(404, 'Transaction not found');
  }
  throw err;
}

// The Prisma model plus its joined category, and files only when the caller
// included them.
type TransactionRow = PrismaTransaction & {
  category: PrismaCategory;
  files?: PrismaTransactionFile[];
};

// The list orders by date then id; id breaks ties so a cursor always lands on
// exactly one row, which day-precision dates alone cannot guarantee.
const CURSOR_SEPARATOR = '_';

function encodeCursor(transaction: { date: Date; id: string }): string {
  return `${transaction.date.toISOString()}${CURSOR_SEPARATOR}${transaction.id}`;
}

function decodeCursor(cursor: string): { date: Date; id: string } {
  const separatorIndex = cursor.indexOf(CURSOR_SEPARATOR);
  const date = new Date(cursor.slice(0, separatorIndex));
  const id = cursor.slice(separatorIndex + 1);
  if (separatorIndex === -1 || Number.isNaN(date.getTime()) || !id) {
    throw new HttpError(400, 'Invalid cursor');
  }
  return { date, id };
}

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
      _count: { _all: true },
      where: this.buildListWhere(filters, startDate, endDate),
    });

    const groupOf = (type: TransactionType) =>
      groups.find((group) => group.type === type);

    return {
      totalIncome: groupOf(TransactionType.INCOME)?._sum.value ?? 0,
      totalExpense: groupOf(TransactionType.EXPENSE)?._sum.value ?? 0,
      count: groups.reduce((total, group) => total + group._count._all, 0),
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

  /**
   * Offset paging, kept for the server-side callers that walk every page
   * (backup, summaries, trends). The UI list uses getTransactionsList.
   */
  public async getTransactions(
    filters: TransactionFilters,
  ): Promise<Transaction[]> {
    const { startDate, endDate } = this.getNormalizedDateRange(
      filters.startDate,
      filters.endDate,
    );

    const transactions = await prisma.transaction.findMany({
      where: this.buildListWhere(filters, startDate, endDate),
      include: { category: true },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      skip: (filters.page - 1) * filters.perPage,
      take: filters.perPage,
    });
    return transactions.map(this.mapToDomain);
  }

  /**
   * Keyset paging for the UI list: each page seeks straight to the cursor
   * instead of counting past the rows before it, so page cost stays flat no
   * matter how deep the user scrolls.
   */
  public async getTransactionsList(
    filters: TransactionListFilters,
  ): Promise<TransactionListPage> {
    const { startDate, endDate } = this.getNormalizedDateRange(
      filters.startDate,
      filters.endDate,
    );

    const transactions = await prisma.transaction.findMany({
      where: {
        ...this.buildListWhere(filters, startDate, endDate),
        ...this.buildCursorWhere(filters.cursor),
      },
      include: { category: true },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      // One extra row answers "is there another page?" without a count query.
      take: filters.limit + 1,
    });

    const hasMore = transactions.length > filters.limit;
    const items = hasMore ? transactions.slice(0, filters.limit) : transactions;

    return {
      items: items.map(this.mapToDomain),
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    };
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
    const transaction = await prisma.transaction
      .update({
        where: { id, userId },
        data: { status },
      })
      .catch(throwNotFoundOnMissingRow);
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
    const transaction = await prisma.transaction
      .update({
        where: { id, userId },
        data: {
          description: data.description,
          value: data.value,
          date: data.date,
          categoryId: data.categoryId,
          type: data.type,
          status: data.status,
        },
      })
      .catch(throwNotFoundOnMissingRow);
    return transaction.id;
  }

  public async deleteTransaction(id: string, userId: string): Promise<void> {
    await prisma.transaction
      .delete({
        where: { id, userId },
      })
      .catch(throwNotFoundOnMissingRow);
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

  /**
   * The single predicate behind both the list and the summary. Search is a SQL
   * filter rather than an in-memory rank so the totals cover exactly the rows
   * the list pages through.
   */
  private buildListWhere(
    filters: TransactionSummaryFilters,
    startDate: Date | undefined,
    endDate: Date | undefined,
  ) {
    const searchTerm = filters.searchTerm?.trim();
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
      ...(searchTerm
        ? {
            description: {
              contains: searchTerm,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      status: filters.status || TransactionStatus.APPROVED,
      userId: filters.userId,
    };
  }

  // Rows strictly after the cursor in (date desc, id desc) order.
  private buildCursorWhere(cursor: string | undefined) {
    if (!cursor) {
      return {};
    }
    const { date, id } = decodeCursor(cursor);
    return {
      OR: [{ date: { lt: date } }, { date, id: { lt: id } }],
    };
  }
}

export default new TransactionRepository();
