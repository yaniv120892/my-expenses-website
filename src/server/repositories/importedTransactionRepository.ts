import {
  Prisma,
  ImportedTransaction,
  TransactionType,
  ImportedTransactionStatus,
} from '@prisma/client';
import prisma from '@/server/db/client';

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
  ): Promise<ImportedTransaction[]> {
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

  public async findById(id: string): Promise<ImportedTransaction | null> {
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

  public async clearMatchingTransaction(
    id: string,
    userId: string,
  ): Promise<void> {
    await prisma.importedTransaction.update({
      where: { id, userId },
      data: { matchingTransactionId: null },
    });
  }

  public async updateStatus(
    id: string,
    userId: string,
    status: ImportedTransactionStatus,
  ): Promise<void> {
    await prisma.importedTransaction.update({
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

  public async findPendingByImportId(
    importId: string,
    userId: string,
  ): Promise<ImportedTransaction[]> {
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

    const existingKeys = new Set(
      existingTransactions.map(
        (tx) => `${tx.description}|${tx.value}|${tx.date.getTime()}|${tx.type}`,
      ),
    );

    return transactions.filter((tx) => {
      const key = `${tx.description}|${tx.value}|${tx.date.getTime()}|${tx.type}`;
      return !existingKeys.has(key);
    });
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

    const existingTransactions = await prisma.importedTransaction.findMany({
      where: {
        importId,
        OR: transactions.map((tx) => ({
          description: tx.description,
          value: tx.value,
          date: tx.date,
          type: tx.type,
        })),
      },
    });

    return existingTransactions;
  }
}

export const importedTransactionRepository =
  new ImportedTransactionRepository();
