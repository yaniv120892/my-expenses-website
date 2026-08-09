import {
  Prisma,
  ImportedTransaction,
  TransactionType,
  ImportedTransactionStatus,
} from '@prisma/client';
import prisma from '@/server/db/client';

export class ImportedTransactionRepository {
  async createMany(
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

  async findByUserIdAndImportId(
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

  async findByImportId(importId: string): Promise<ImportedTransaction[]> {
    return prisma.importedTransaction.findMany({
      where: {
        importId,
        deleted: false,
      },
      orderBy: { date: 'desc' },
    });
  }

  async findById(id: string): Promise<ImportedTransaction | null> {
    return prisma.importedTransaction.findUnique({
      where: { id },
      include: {
        matchingTransaction: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.importedTransaction.delete({
      where: { id },
    });
  }

  async clearMatchingTransaction(id: string, userId: string): Promise<void> {
    await prisma.importedTransaction.update({
      where: { id, userId },
      data: { matchingTransactionId: null },
    });
  }

  async updateStatus(
    id: string,
    userId: string,
    status: ImportedTransactionStatus,
  ): Promise<void> {
    await prisma.importedTransaction.update({
      where: { id, userId },
      data: { status },
    });
  }

  async softDelete(id: string, userId: string): Promise<void> {
    await prisma.importedTransaction.update({
      where: { id, userId },
      data: { deleted: true },
    });
  }

  async updateStatusBatch(
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

  async findPendingByImportId(
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

  async softDeleteBatch(ids: string[], userId: string): Promise<number> {
    const result = await prisma.importedTransaction.updateMany({
      where: { id: { in: ids }, userId },
      data: { deleted: true },
    });
    return result.count;
  }

  async filterDuplicates(
    importId: string,
    transactions: {
      description: string;
      value: number;
      date: Date;
      type: TransactionType;
      rawData: Prisma.InputJsonValue;
      matchingTransactionId: string | null;
      userId: string;
    }[],
  ): Promise<typeof transactions> {
    if (transactions.length === 0) return [];

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
    if (transactions.length === 0) return [];

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
