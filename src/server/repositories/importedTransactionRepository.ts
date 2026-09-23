import {
  Prisma,
  ImportedTransaction,
  TransactionType,
  ImportedTransactionStatus,
} from '@prisma/client';
import prisma from '@/server/db/client';
import { isSameCharge } from '@/server/utils/transactionMatching';

export type ImportedTransactionWithMatch =
  Prisma.ImportedTransactionGetPayload<{
    include: { matchingTransaction: true };
  }>;

type DuplicateComparable = {
  description: string;
  value: number;
  date: Date;
  type: TransactionType;
};

/**
 * Each existing row is claimed by at most one incoming row, so a genuinely
 * repeated charge still imports.
 */
export function selectNonDuplicateRows<T extends DuplicateComparable>(
  existing: DuplicateComparable[],
  incoming: T[],
): T[] {
  const unclaimed = [...existing];

  return incoming.filter((row) => {
    const claimed = unclaimed.findIndex((candidate) =>
      isSameCharge(candidate, row),
    );
    if (claimed === -1) {
      return true;
    }
    unclaimed.splice(claimed, 1);
    return false;
  });
}

const PENDING_ROW = {
  status: ImportedTransactionStatus.PENDING,
  deleted: false,
} as const;

export class ImportedTransactionRepository {
  public async createMany(
    transactions: {
      importId: string;
      description: string;
      value: number;
      date: Date;
      type: TransactionType;
      matchingTransactionId: string | null;
      rawData: Prisma.InputJsonValue;
      userId: string;
    }[],
  ): Promise<number> {
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
      include: {
        matchingTransaction: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  public async findByImportId(
    importId: string,
  ): Promise<ImportedTransaction[]> {
    return prisma.importedTransaction.findMany({
      where: {
        importId,
        deleted: false,
      },
      orderBy: { date: 'desc' },
    });
  }

  public async findById(
    id: string,
  ): Promise<ImportedTransactionWithMatch | null> {
    return prisma.importedTransaction.findUnique({
      where: { id },
      include: {
        matchingTransaction: true,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.importedTransaction.delete({
      where: { id },
    });
  }

  /**
   * Unawaited so approval can batch it with the transaction it creates. Scoped
   * to a pending row, so a concurrent approval fails with P2025 and rolls the
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

  /** Unawaited so a merge can batch it; pending-scoped like markApprovedOp. */
  public updateStatusOp(
    id: string,
    userId: string,
    status: ImportedTransactionStatus,
  ) {
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
        status: ImportedTransactionStatus.PENDING,
        deleted: false,
      },
      include: {
        matchingTransaction: true,
      },
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
        status: ImportedTransactionStatus.PENDING,
        deleted: false,
      },
      include: {
        matchingTransaction: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  public async softDeleteBatch(ids: string[], userId: string): Promise<number> {
    const result = await prisma.importedTransaction.updateMany({
      where: { id: { in: ids }, userId },
      data: { deleted: true },
    });
    return result.count;
  }

  /** Unawaited so the caller can batch it with the delete that follows. */
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

  /** Hard delete: the parent import row is about to go, and the FK is Restrict. */
  public deleteByImportIdOp(importId: string) {
    return prisma.importedTransaction.deleteMany({ where: { importId } });
  }

  public async findClaimedMatchingTransactionIds(
    userId: string,
  ): Promise<string[]> {
    const claimed = await prisma.importedTransaction.findMany({
      where: {
        userId,
        deleted: false,
        status: ImportedTransactionStatus.PENDING,
        matchingTransactionId: { not: null },
      },
      select: { matchingTransactionId: true },
    });

    return claimed.map((row) => row.matchingTransactionId!);
  }

  public async filterDuplicates<
    T extends {
      description: string;
      value: number;
      date: Date;
      type: TransactionType;
    },
  >(importId: string, transactions: T[]): Promise<T[]> {
    if (transactions.length === 0) {
      return [];
    }

    const existingTransactions = await this.findExistingTransactions(importId);

    return selectNonDuplicateRows(existingTransactions, transactions);
  }

  // The whole import rather than an OR per row: selectNonDuplicateRows re-
  // derives the comparison anyway, and a hand-built OR would have to stay in
  // sync with it.
  private async findExistingTransactions(
    importId: string,
  ): Promise<ImportedTransaction[]> {
    return prisma.importedTransaction.findMany({
      where: { importId, deleted: false },
    });
  }
}

export const importedTransactionRepository =
  new ImportedTransactionRepository();
