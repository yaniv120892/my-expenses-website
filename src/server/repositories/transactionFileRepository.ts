import { TransactionFile, TransactionFileStatus } from '@prisma/client';
import prisma from '@/server/db/client';

export class TransactionFileRepository {
  public async create(data: {
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

  public async findById(id: string): Promise<TransactionFile | null> {
    return prisma.transactionFile.findUnique({
      where: { id },
    });
  }

  public async findByTransactionId(
    transactionId: string,
  ): Promise<TransactionFile[]> {
    return prisma.transactionFile.findMany({
      where: {
        transactionId,
        status: TransactionFileStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async updateStatus(
    id: string,
    status: TransactionFileStatus,
  ): Promise<TransactionFile> {
    return prisma.transactionFile.update({
      where: { id },
      data: { status },
    });
  }

  public async markForDeletion(id: string): Promise<TransactionFile> {
    return this.updateStatus(id, TransactionFileStatus.MARKED_FOR_DELETION);
  }
}

export default new TransactionFileRepository();
