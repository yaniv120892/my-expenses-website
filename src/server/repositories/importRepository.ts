import {
  Prisma,
  Import,
  ImportFileType,
  ImportStatus,
  ImportBankSourceType,
  ImportedTransactionStatus,
} from '@prisma/client';
import prisma from '@/server/db/client';

export type ImportWithPendingCount = Import & {
  _count: {
    transactions: number;
  };
};

export class ImportRepository {
  async create(data: {
    fileUrl: string;
    originalFileName: string;
    importType: ImportFileType | null;
    bankSourceType: ImportBankSourceType | null;
    userId: string;
    creditCardLastFourDigits?: string | null;
    paymentMonth: string | null;
    excelExtractionRequestId: string | null;
  }): Promise<Import> {
    return prisma.import.create({
      data: {
        ...data,
        status: ImportStatus.PROCESSING,
      },
    });
  }

  async findById(id: string): Promise<Import | null> {
    return prisma.import.findUnique({
      where: { id },
    });
  }

  async findByUserId(userId: string): Promise<ImportWithPendingCount[]> {
    return prisma.import.findMany({
      where: { userId, deleted: false },
      orderBy: [{ createdAt: 'desc' }, { paymentMonth: 'desc' }],
      include: {
        _count: {
          select: {
            transactions: {
              where: {
                status: ImportedTransactionStatus.PENDING,
                deleted: false,
              },
            },
          },
        },
      },
    });
  }

  async findByExtractionRequestId(
    excelExtractionRequestId: string,
  ): Promise<Import | null> {
    return prisma.import.findFirst({
      where: { excelExtractionRequestId },
    });
  }

  async findExisting(
    userId: string,
    paymentMonth: string,
    creditCardLastFourDigits: string,
  ): Promise<Import | null> {
    const imports = await prisma.import.findMany({
      where: {
        userId,
        paymentMonth,
      },
      orderBy: { createdAt: 'desc' },
    });

    // creditCardLastFourDigits is encrypted at rest; prisma-field-encryption
    // decrypts on read, so matching must happen in memory, not in the query.
    for (const imp of imports) {
      if (imp.creditCardLastFourDigits === creditCardLastFourDigits) {
        return imp;
      }
    }

    return null;
  }

  async softDelete(id: string, userId: string): Promise<void> {
    await prisma.import.update({
      where: { id, userId },
      data: { deleted: true },
    });
  }

  async updateStatus(
    id: string,
    status: ImportStatus,
    error?: string,
  ): Promise<Import> {
    const data: Prisma.ImportUpdateInput = {
      status,
      ...(status === ImportStatus.COMPLETED && { completedAt: new Date() }),
      ...(error && { error }),
    };

    return prisma.import.update({
      where: { id },
      data,
    });
  }
}

export const importRepository = new ImportRepository();
