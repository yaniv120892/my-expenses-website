import type { Prisma, ImportedTransaction, TransactionType } from '@/generated/prisma/client';
import { ImportedTransactionStatus } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import { isSameCharge } from '@/server/utils/transactionMatching';
import type { ImportedAmountColumns } from '@/server/repositories/amountColumns.types';

const WITH_MATCH = {
  matchingTransaction: {
    include: {
      scheduledTransaction: { select: { bankDescriptionPrefix: true } },
    },
  },
} satisfies Prisma.ImportedTransactionInclude;

export type ImportedTransactionWithMatch = Prisma.ImportedTransactionGetPayload<{
  include: typeof WITH_MATCH;
}>;

type DuplicateComparable = {
  description: string;
  value: number | null;
  currency: string | null;
  originalAmount: { toString(): string };
  date: Date;
  type: TransactionType;
};

export function selectNonDuplicateRows<T extends DuplicateComparable>(
  existing: DuplicateComparable[],
  incoming: T[],
): T[] {
  const unclaimed = [...existing];

  return incoming.filter((row) => {
    const claimed = unclaimed.findIndex((candidate) => isSameCharge(candidate, row));
    if (claimed === -1) {
      return true;
    }
    unclaimed.splice(claimed, 1);
    return false;
  });
}

type ImportedTransactionCreateRow = ImportedAmountColumns & {
  importId: string;
  description: string;
  date: Date;
  type: TransactionType;
  matchingTransactionId: string | null;
  rawData: Prisma.InputJsonValue;
  userId: string;
};

const PENDING_ROW = {
  status: ImportedTransactionStatus.PENDING,
  deleted: false,
} as const;

// An import deleted before deleteImport began flagging its rows left them
// live, so reads of rows to act on also check the import.
const PENDING_ROW_OF_LIVE_IMPORT = {
  ...PENDING_ROW,
  import: { deleted: false },
} satisfies Prisma.ImportedTransactionWhereInput;

export class ImportedTransactionRepository {
  public async createMany(transactions: ImportedTransactionCreateRow[]): Promise<number> {
    const result = await prisma.importedTransaction.createMany({
      data: transactions,
    });
    return result.count;
  }

  public async findByUserIdAndImportId(
    userId: string,
    importId: string,
  ): Promise<ImportedTransactionWithMatch[]> {
    return prisma.importedTransaction.findMany({
      where: {
        userId,
        importId,
        deleted: false,
      },
      include: WITH_MATCH,
      orderBy: { date: 'desc' },
    });
  }

  public async findByImportId(importId: string): Promise<ImportedTransaction[]> {
    return prisma.importedTransaction.findMany({
      where: {
        importId,
        deleted: false,
      },
      orderBy: { date: 'desc' },
    });
  }

  public async findById(id: string): Promise<ImportedTransactionWithMatch | null> {
    return prisma.importedTransaction.findUnique({
      where: { id },
      include: WITH_MATCH,
    });
  }

  /**
   * Pending-scoped, so a concurrent approval fails with P2025 and rolls the
   * batch back instead of creating the transaction twice.
   */
  public markApprovedOp(id: string, userId: string) {
    return prisma.importedTransaction.update({
      where: { id, userId, ...PENDING_ROW },
      data: {
        status: ImportedTransactionStatus.APPROVED,
        matchingTransactionId: null,
      },
    });
  }

  public async updateStatus(
    id: string,
    userId: string,
    status: ImportedTransactionStatus,
  ): Promise<void> {
    await this.updateStatusOp(id, userId, status);
  }

  /** Pending-scoped like markApprovedOp. */
  public updateStatusOp(id: string, userId: string, status: ImportedTransactionStatus) {
    return prisma.importedTransaction.update({
      where: { id, userId, ...PENDING_ROW },
      data: { status },
    });
  }

  public async softDelete(id: string, userId: string): Promise<void> {
    await prisma.importedTransaction.update({
      where: { id, userId },
      data: { deleted: true },
    });
  }

  public async updateStatusBatch(
    ids: string[],
    userId: string,
    status: ImportedTransactionStatus,
  ): Promise<number> {
    const result = await prisma.importedTransaction.updateMany({
      where: { id: { in: ids }, userId, ...PENDING_ROW },
      data: { status },
    });
    return result.count;
  }

  public async findPendingByIds(
    importId: string,
    ids: string[],
    userId: string,
  ): Promise<ImportedTransactionWithMatch[]> {
    return prisma.importedTransaction.findMany({
      where: {
        importId,
        id: { in: ids },
        userId,
        ...PENDING_ROW_OF_LIVE_IMPORT,
      },
      include: WITH_MATCH,
      orderBy: { date: 'desc' },
    });
  }

  public async findPendingByImportId(
    importId: string,
    userId: string,
  ): Promise<ImportedTransactionWithMatch[]> {
    return prisma.importedTransaction.findMany({
      where: {
        importId,
        userId,
        ...PENDING_ROW_OF_LIVE_IMPORT,
      },
      include: WITH_MATCH,
      orderBy: { date: 'desc' },
    });
  }

  public moveToImportOps(ids: string[], importId: string) {
    if (ids.length === 0) {
      return [];
    }

    return [
      prisma.importedTransaction.updateMany({
        where: { id: { in: ids } },
        data: { importId },
      }),
    ];
  }

  public softDeleteByImportIdOp(importId: string, userId: string) {
    return prisma.importedTransaction.updateMany({
      where: { importId, userId },
      data: { deleted: true },
    });
  }

  /** Hard delete: the parent import row is about to go, and the FK is Restrict. */
  public deleteByImportIdOp(importId: string) {
    return prisma.importedTransaction.deleteMany({ where: { importId } });
  }

  public async findClaimedMatchingTransactionIds(userId: string): Promise<string[]> {
    const claimed = await prisma.importedTransaction.findMany({
      where: {
        userId,
        ...PENDING_ROW_OF_LIVE_IMPORT,
        matchingTransactionId: { not: null },
      },
      select: { matchingTransactionId: true },
    });

    return claimed.flatMap(({ matchingTransactionId }) =>
      matchingTransactionId === null ? [] : [matchingTransactionId],
    );
  }

  public async filterDuplicates<T extends DuplicateComparable>(
    importId: string,
    transactions: T[],
  ): Promise<T[]> {
    if (transactions.length === 0) {
      return [];
    }

    const existingTransactions = await this.findExistingTransactions(importId);

    return selectNonDuplicateRows(existingTransactions, transactions);
  }

  // The whole import rather than an OR per row: selectNonDuplicateRows re-
  // derives the comparison anyway, and a hand-built OR would have to stay in
  // sync with it.
  private async findExistingTransactions(importId: string): Promise<ImportedTransaction[]> {
    return prisma.importedTransaction.findMany({
      where: { importId, deleted: false },
    });
  }
}

export const importedTransactionRepository = new ImportedTransactionRepository();
