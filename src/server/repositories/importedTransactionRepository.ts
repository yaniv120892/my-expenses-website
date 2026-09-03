import {
  Prisma,
  ImportedTransaction,
  TransactionType,
  ImportedTransactionStatus,
} from '@prisma/client';
import prisma from '@/server/db/client';
import { isSameCharge } from '@/server/utils/transactionMatching';

// The queries that include the matched transaction return more than the bare
// model describes, and callers decide merge-vs-create from that relation.
type ImportedTransactionWithMatch = Prisma.ImportedTransactionGetPayload<{
  include: { matchingTransaction: true };
}>;

type DuplicateComparable = {
  description: string;
  value: number;
  date: Date;
  type: TransactionType;
};

/**
 * The rows of `incoming` that `existing` does not already account for, using
 * isSameCharge as the identity. Each existing row is claimed by at most one
 * incoming row, so a statement that genuinely charges the same amount twice on
 * a day still brings both across.
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
   * Records approval — the row is APPROVED and its match claim released.
   * Unawaited so approval can batch it with the transaction it creates.
   */
  public markApprovedOp(id: string, userId: string) {
    return prisma.importedTransaction.update({
      where: { id, userId },
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

  /** Unawaited so approval/merge can batch it with the writes it records. */
  public updateStatusOp(
    id: string,
    userId: string,
    status: ImportedTransactionStatus,
  ) {
    return prisma.importedTransaction.update({
      where: { id, userId },
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
      where: { id: { in: ids }, userId },
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

  /**
   * Reassigns rows to another import, used when merging a duplicate import.
   * Returned unawaited so the caller can batch it into one transaction with
   * the delete that follows.
   */
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

  /**
   * Transactions already claimed as a match by any pending imported row of
   * this user, so a concurrent import cannot claim the same one.
   */
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

    const existingTransactions = await this.findExistingTransactions(
      importId,
      transactions,
    );

    return selectNonDuplicateRows(existingTransactions, transactions);
  }

  private async findExistingTransactions(
    importId: string,
    transactions: {
      description: string;
      value: number;
      date: Date;
      type: TransactionType;
    }[],
  ): Promise<ImportedTransaction[]> {
    if (transactions.length === 0) {
      return [];
    }

    // The whole import rather than a disjunction per incoming row: the set is
    // one statement's worth of rows, and selectNonDuplicateRows re-derives the
    // comparison anyway, so a hand-built OR would only have to stay in sync
    // with it.
    return prisma.importedTransaction.findMany({ where: { importId } });
  }
}

export const importedTransactionRepository =
  new ImportedTransactionRepository();
