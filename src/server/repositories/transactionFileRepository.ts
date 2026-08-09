import { TransactionFile, TransactionFileStatus } from '@prisma/client';
import prisma from '@/server/db/client';

export class TransactionFileRepository {
  async create(data: {
    transactionId: string;
    fileName: string;
    fileKey: string;
    fileSize: number;
    mimeType: string;
  }): Promise<TransactionFile> {
    return prisma.transactionFile.create({
      data: {
        ...data,
        status: TransactionFileStatus.ACTIVE,
      },
    });
  }

  async findById(id: string): Promise<TransactionFile | null> {
    return prisma.transactionFile.findUnique({
      where: { id },
    });
  }

  async findByTransactionId(transactionId: string): Promise<TransactionFile[]> {
    return prisma.transactionFile.findMany({
      where: {
        transactionId,
        status: TransactionFileStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: TransactionFileStatus,
  ): Promise<TransactionFile> {
    return prisma.transactionFile.update({
      where: { id },
      data: { status },
    });
  }

  async markForDeletion(id: string): Promise<TransactionFile> {
    return this.updateStatus(id, TransactionFileStatus.MARKED_FOR_DELETION);
  }
}

export default new TransactionFileRepository();
