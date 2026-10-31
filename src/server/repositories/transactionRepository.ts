import { z } from 'zod';
import { recordIdSchema } from '@/shared/schemas/common';
import type {
  Prisma,
  Transaction as PrismaTransaction,
  TransactionFile as PrismaTransactionFile,
  Category as PrismaCategory,
} from '@/generated/prisma/client';
import { TransactionType, TransactionStatus } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import {
  canMatch,
  type MatchableCharge,
  type MatchWindow,
  matchWindow,
} from '@/server/utils/transactionMatching';
import type {
  TransactionFilters,
  Transaction,
  TransactionListFilters,
  TransactionListPage,
  TransactionSummaryFilters,
  TransactionSummary,
} from '@/shared/types/transaction';
import type {
  CreateTransactionDbModel,
  MatchCandidateTransaction,
  UpdateTransactionDbModel,
} from '@/server/repositories/types';
import { endOfDay, startOfDay } from 'date-fns';
import { HttpError } from '@/server/http/errors';
import { getPrismaErrorCode, PRISMA_ERROR_CODES } from '@/server/db/prismaErrors';
import type { CategoryTotal } from '@/server/utils/categoryHierarchy.types';
import { fromAmountColumns, toAmountColumns } from '@/server/repositories/amountColumns';
import {
  DEFAULT_TRANSACTION_SORT,
  type SortOrder,
  type TransactionSort,
} from '@/shared/schemas/transactions';

const MATCHABLE_STATUSES = [TransactionStatus.APPROVED, TransactionStatus.PENDING_APPROVAL];

// An update/delete matching no row means the transaction does not exist or
// belongs to another household.
function throwNotFoundOnMissingRow(err: unknown): never {
  if (getPrismaErrorCode(err) === PRISMA_ERROR_CODES.RECORD_NOT_FOUND) {
    throw new HttpError(404, 'Transaction not found');
  }
  throw err;
}

const ATTRIBUTION_INCLUDE = {
  createdBy: { select: { username: true } },
  updatedBy: { select: { username: true } },
} as const;

type TransactionRow = PrismaTransaction & {
  category: PrismaCategory;
  files?: PrismaTransactionFile[];
  createdBy?: { username: string } | null;
  updatedBy?: { username: string } | null;
};

type Comparison = 'lt' | 'gt' | 'equals';

type SortColumn = {
  orderBy(direction: SortOrder): Prisma.TransactionOrderByWithRelationInput;
  toCursor(row: TransactionRow): string;
  where(comparison: Comparison, cursorValue: string): Prisma.TransactionWhereInput;
};

type OrderedColumn = [SortColumn, SortOrder];

type CursorKey = { column: SortColumn; direction: SortOrder; value: string };

/**
 * startDate floors to the day's start and endDate widens to its end; callers
 * such as the daily summary rely on this.
 */
export function normalizeDateRange(startDate?: Date, endDate?: Date) {
  return {
    startDate: startDate ? startOfDay(new Date(startDate)) : undefined,
    endDate: endDate ? endOfDay(new Date(endDate)) : undefined,
  };
}

function invalidCursor(): never {
  throw new HttpError(400, 'Invalid cursor');
}

const DATE_COLUMN: SortColumn = {
  orderBy: (direction) => ({ date: direction }),
  toCursor: (row) => row.date.toISOString(),
  where: (comparison, cursorValue) => {
    const date = new Date(cursorValue);
    if (Number.isNaN(date.getTime())) {
      invalidCursor();
    }
    return { date: { [comparison]: date } };
  },
};

const amountCursorSchema = z.string().trim().min(1).pipe(z.coerce.number());

const AMOUNT_COLUMN: SortColumn = {
  orderBy: (direction) => ({ value: direction }),
  toCursor: (row) => String(row.value),
  where: (comparison, cursorValue) => {
    const value = amountCursorSchema.safeParse(cursorValue);
    if (!value.success) {
      invalidCursor();
    }
    return { value: { [comparison]: value.data } };
  },
};

const CATEGORY_COLUMN: SortColumn = {
  orderBy: (direction) => ({ category: { name: direction } }),
  toCursor: (row) => row.category.name,
  where: (comparison, cursorValue) => ({
    category: { name: { [comparison]: cursorValue } },
  }),
};

const ID_COLUMN: SortColumn = {
  orderBy: (direction) => ({ id: direction }),
  toCursor: (row) => row.id,
  where: (comparison, cursorValue) => {
    if (!recordIdSchema.safeParse(cursorValue).success) {
      invalidCursor();
    }
    return { id: { [comparison]: cursorValue } };
  },
};

const PRIMARY_COLUMNS: Record<TransactionSort['sortBy'], SortColumn> = {
  date: DATE_COLUMN,
  amount: AMOUNT_COLUMN,
  category: CATEGORY_COLUMN,
};

// id is always last, so a cursor lands on exactly one row; ties on amount or
// category fall back to newest first.
function listOrdering({
  sortBy = DEFAULT_TRANSACTION_SORT.sortBy,
  sortOrder = DEFAULT_TRANSACTION_SORT.sortOrder,
}: Partial<TransactionSort>): OrderedColumn[] {
  const tieBreakers: OrderedColumn[] =
    sortBy === 'date'
      ? [[ID_COLUMN, sortOrder]]
      : [
          [DATE_COLUMN, 'desc'],
          [ID_COLUMN, 'desc'],
        ];
  return [[PRIMARY_COLUMNS[sortBy], sortOrder], ...tieBreakers];
}

function encodeCursor(ordering: OrderedColumn[], row: TransactionRow): string {
  const values = ordering.map(([column]) => column.toCursor(row));
  return Buffer.from(JSON.stringify(values)).toString('base64url');
}

function decodeCursor(cursor: string, ordering: OrderedColumn[]): CursorKey[] {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    invalidCursor();
  }
  const values = z.array(z.string()).length(ordering.length).safeParse(decoded);
  if (!values.success) {
    invalidCursor();
  }
  return ordering.map(([column, direction], index) => {
    const value = values.data[index];
    if (value === undefined) {
      invalidCursor();
    }
    return { column, direction, value };
  });
}

class TransactionRepository {
  public async getTransactionsSummary(
    householdId: HouseholdId,
    filters: TransactionSummaryFilters,
  ): Promise<TransactionSummary> {
    const { startDate, endDate } = normalizeDateRange(filters.startDate, filters.endDate);
    const groups = await prisma.transaction.groupBy({
      by: ['type'],
      _sum: { value: true },
      _count: { _all: true },
      where: this.buildListWhere(householdId, filters, startDate, endDate),
    });

    const incomeGroup = groups.find((group) => group.type === TransactionType.INCOME);
    const expenseGroup = groups.find((group) => group.type === TransactionType.EXPENSE);
    const incomeCount = incomeGroup?._count._all ?? 0;
    const expenseCount = expenseGroup?._count._all ?? 0;

    return {
      totalIncome: incomeGroup?._sum.value ?? 0,
      totalExpense: expenseGroup?._sum.value ?? 0,
      count: incomeCount + expenseCount,
      incomeCount,
      expenseCount,
    };
  }

  public async getCategoryTotals(
    householdId: HouseholdId,
    filters: TransactionSummaryFilters,
  ): Promise<CategoryTotal[]> {
    const { startDate, endDate } = normalizeDateRange(filters.startDate, filters.endDate);
    const groups = await prisma.transaction.groupBy({
      by: ['categoryId'],
      _sum: { value: true },
      where: this.buildListWhere(householdId, filters, startDate, endDate),
    });
    return groups.map((group) => ({
      categoryId: group.categoryId,
      amount: group._sum.value ?? 0,
    }));
  }

  public async createTransaction(data: CreateTransactionDbModel): Promise<Transaction> {
    const transaction = await prisma.transaction.create({
      data: this.toCreateData(data),
      include: { category: true, ...ATTRIBUTION_INCLUDE },
    });
    return this.mapToDomain(transaction);
  }

  /** Unawaited so the caller can batch it with related writes. */
  public createTransactionOp(data: CreateTransactionDbModel) {
    return prisma.transaction.create({ data: this.toCreateData(data) });
  }

  /**
   * Offset paging for callers that address pages by number; new callers should
   * prefer getTransactionsList.
   */
  public async getTransactions(
    householdId: HouseholdId,
    filters: TransactionFilters,
  ): Promise<Transaction[]> {
    const { startDate, endDate } = normalizeDateRange(filters.startDate, filters.endDate);

    const transactions = await prisma.transaction.findMany({
      where: this.buildListWhere(householdId, filters, startDate, endDate),
      include: { category: true, ...ATTRIBUTION_INCLUDE },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      skip: (filters.page - 1) * filters.perPage,
      take: filters.perPage,
    });
    return transactions.map(this.mapToDomain);
  }

  public async getTransactionsList(
    householdId: HouseholdId,
    filters: TransactionListFilters,
  ): Promise<TransactionListPage> {
    const { startDate, endDate } = normalizeDateRange(filters.startDate, filters.endDate);

    const ordering = listOrdering(filters);
    const transactions = await prisma.transaction.findMany({
      where: {
        ...this.buildListWhere(householdId, filters, startDate, endDate),
        ...this.buildCursorWhere(ordering, filters.cursor),
      },
      include: { category: true, ...ATTRIBUTION_INCLUDE },
      orderBy: ordering.map(([column, direction]) => column.orderBy(direction)),
      // One extra row answers "is there another page?" without a count query.
      take: filters.limit + 1,
    });

    const hasMore = transactions.length > filters.limit;
    const items = hasMore ? transactions.slice(0, filters.limit) : transactions;
    const lastItem = hasMore ? items.at(-1) : undefined;

    return {
      items: items.map(this.mapToDomain),
      nextCursor: lastItem ? encodeCursor(ordering, lastItem) : null,
    };
  }

  public async getPendingTransactions(householdId: HouseholdId): Promise<Transaction[]> {
    const transactions = await prisma.transaction.findMany({
      where: { status: TransactionStatus.PENDING_APPROVAL, householdId },
      include: { category: true, ...ATTRIBUTION_INCLUDE },
      orderBy: { date: 'desc' },
    });
    return transactions.map(this.mapToDomain);
  }

  public async updateTransactionStatus(
    householdId: HouseholdId,
    id: string,
    status: TransactionStatus,
  ): Promise<{ id: string; description: string }> {
    const updated = await prisma.transaction
      .update({
        where: { id, householdId },
        data: { status },
        select: { id: true, description: true },
      })
      .catch(throwNotFoundOnMissingRow);
    return updated;
  }

  public async getTransactionItem(
    householdId: HouseholdId,
    transactionId: string,
  ): Promise<Transaction | null> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId, householdId },
      include: {
        category: true,
        ...ATTRIBUTION_INCLUDE,
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
      ...fromAmountColumns(transaction),
      date: transaction.date,
      type: transaction.type,
      status: transaction.status,
      category: {
        id: transaction.category.id,
        name: transaction.category.name,
      },
      addedBy: transaction.createdBy?.username ?? null,
      editedBy: transaction.updatedBy?.username ?? null,
      addedAutomatically: transaction.createdBySystem,
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
    householdId: HouseholdId,
    id: string,
    data: UpdateTransactionDbModel,
  ): Promise<Transaction> {
    const transaction = await prisma.transaction
      .update({
        where: { id, householdId },
        data: this.toUpdateData(data),
        include: { category: true, ...ATTRIBUTION_INCLUDE },
      })
      .catch(throwNotFoundOnMissingRow);
    return this.mapToDomain(transaction);
  }

  /** Unawaited for batching; a missing row fails as a raw Prisma error, not a 404. */
  public updateTransactionOp(householdId: HouseholdId, id: string, data: UpdateTransactionDbModel) {
    return prisma.transaction.update({
      where: { id, householdId },
      data: this.toUpdateData(data),
    });
  }

  /** Returns the attachment keys the cascade dropped, read by the delete itself. */
  public async deleteTransaction(householdId: HouseholdId, id: string): Promise<string[]> {
    const deleted = await prisma.transaction
      .delete({
        where: { id, householdId },
        select: { files: { select: { fileKey: true } } },
      })
      .catch(throwNotFoundOnMissingRow);
    return deleted.files.map((file) => file.fileKey);
  }

  /** The caller folds the day rows into whatever period buckets it needs. */
  public async getCategoryPeriodTotals(params: {
    householdId: HouseholdId;
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
    const { startDate, endDate } = normalizeDateRange(params.startDate, params.endDate);

    const groups = await prisma.transaction.groupBy({
      by: ['categoryId', 'type', 'date'],
      _sum: { value: true },
      _count: { _all: true },
      where: {
        householdId: params.householdId,
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

  public async findPotentialMatches(
    householdId: HouseholdId,
    charge: MatchableCharge,
  ): Promise<MatchCandidateTransaction[]> {
    return this.findPotentialMatchesForCharges(householdId, [charge]);
  }

  // Which charge each returned transaction belongs to is left to the caller,
  // and so is the description test a variable-amount placeholder must pass:
  // matchCandidateFilter holds both.
  public async findPotentialMatchesForCharges(
    householdId: HouseholdId,
    charges: MatchableCharge[],
  ): Promise<MatchCandidateTransaction[]> {
    const windows = charges.map(matchWindow).filter(canMatch);
    if (windows.length === 0) {
      return [];
    }

    const potentialTransactions = await prisma.transaction.findMany({
      where: {
        householdId,
        status: { in: MATCHABLE_STATUSES },
        OR: [
          ...windows.map((window) => this.buildAmountWindowWhere(window)),
          ...this.buildPlaceholderWheres(windows),
        ],
      },
      orderBy: { status: 'desc' },
      include: {
        category: true,
        scheduledTransaction: { select: { bankDescriptionPrefix: true } },
      },
    });

    return potentialTransactions.map((transaction) => ({
      ...this.mapToDomain(transaction),
      bankDescriptionPrefix: transaction.scheduledTransaction?.bankDescriptionPrefix ?? null,
    }));
  }

  private toCreateData(data: CreateTransactionDbModel) {
    return {
      description: data.description,
      ...toAmountColumns(data),
      date: data.date,
      categoryId: data.categoryId,
      type: data.type,
      status: data.status || TransactionStatus.APPROVED,
      scheduledTransactionId: data.scheduledTransactionId ?? null,
      householdId: data.householdId,
      userId: data.userId,
    };
  }

  private toUpdateData(data: UpdateTransactionDbModel) {
    return {
      description: data.description,
      ...(data.amount ? toAmountColumns(data.amount) : {}),
      date: data.date,
      categoryId: data.categoryId,
      type: data.type,
      status: data.status,
    };
  }

  private buildAmountWindowWhere(window: MatchWindow) {
    const amountConditions = [
      ...(window.valueRange
        ? [
            {
              value: {
                gte: window.valueRange.minimum,
                lte: window.valueRange.maximum,
              },
            },
          ]
        : []),
      ...(window.originalAmountRange
        ? [
            {
              currency: window.originalAmountRange.currency,
              originalAmount: {
                gte: window.originalAmountRange.minimum,
                lte: window.originalAmountRange.maximum,
              },
            },
          ]
        : []),
    ];
    return {
      type: window.type,
      date: { gte: window.earliestDate, lte: window.latestDate },
      OR: amountConditions,
    };
  }

  // One clause per direction spanning every window, not one per charge: a
  // placeholder's own window and prefix are checked in memory anyway.
  private buildPlaceholderWheres(windows: MatchWindow[]) {
    const spanByType = new Map<TransactionType, { gte: Date; lte: Date }>();
    for (const window of windows) {
      const span = spanByType.get(window.type);
      spanByType.set(window.type, {
        gte: span && span.gte < window.earliestDate ? span.gte : window.earliestDate,
        lte: span && span.lte > window.latestDate ? span.lte : window.latestDate,
      });
    }
    return [...spanByType].map(([type, date]) => ({
      type,
      date,
      status: TransactionStatus.PENDING_APPROVAL,
      scheduledTransaction: { bankDescriptionPrefix: { not: null } },
    }));
  }

  /**
   * Shared by the list and the summary, so the totals cover exactly the rows
   * the list pages through.
   */
  private buildListWhere(
    householdId: HouseholdId,
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
      ...this.buildCategoryWhere(filters),
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
      householdId,
    };
  }

  /**
   * The service resolves a category to its subtree, so `categoryIds` wins when
   * present; `categoryId` alone stays an exact match for callers that skip it.
   */
  private buildCategoryWhere(filters: TransactionSummaryFilters) {
    if (filters.categoryIds?.length) {
      return { categoryId: { in: filters.categoryIds } };
    }
    return filters.categoryId ? { categoryId: filters.categoryId } : {};
  }

  // Rows strictly after the cursor: equal on every earlier column, past it on this one.
  private buildCursorWhere(
    ordering: OrderedColumn[],
    cursor: string | undefined,
  ): Prisma.TransactionWhereInput {
    if (!cursor) {
      return {};
    }
    const keys = decodeCursor(cursor, ordering);
    return {
      OR: keys.map(({ column, direction, value }, index) => ({
        AND: [
          ...keys.slice(0, index).map((earlier) => earlier.column.where('equals', earlier.value)),
          column.where(direction === 'desc' ? 'lt' : 'gt', value),
        ],
      })),
    };
  }
}

const transactionRepository = new TransactionRepository();
export default transactionRepository;
