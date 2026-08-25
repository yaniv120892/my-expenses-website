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
  public async create(data: {
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

  public async findById(id: string): Promise<Import | null> {
    return prisma.import.findUnique({
      where: { id },
    });
  }

  public async findByUserId(userId: string): Promise<ImportWithPendingCount[]> {
    return prisma.import.findMany({
      where: { userId, deleted: false },
      // id breaks createdAt ties so the polled list keeps a stable order.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

  public async findByExtractionRequestId(
    excelExtractionRequestId: string,
  ): Promise<Import | null> {
    return prisma.import.findUnique({
      where: { excelExtractionRequestId },
    });
  }

  /**
   * The oldest COMPLETED, non-deleted import for the same card and month —
   * a merge target.
   *
   * Oldest rather than newest makes the merge direction deterministic when two
   * callbacks for the same card land at once: only the younger side finds an
   * eligible target, so only one side merges. COMPLETED is what makes the
   * de-duplication meaningful — an import reaches it only after writing its own
   * rows, so a merge cannot dedupe against a set that is still being filled.
   * Two callbacks racing each other simply both survive as separate imports.
   */
  public async findExisting(
    userId: string,
    paymentMonth: string,
    creditCardLastFourDigits: string,
    excludeImportId?: string,
  ): Promise<Import | null> {
    const imports = await prisma.import.findMany({
      where: {
        userId,
        paymentMonth,
        deleted: false,
        status: ImportStatus.COMPLETED,
        ...(excludeImportId ? { id: { not: excludeImportId } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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

  /**
   * Marks this import's extraction as handled, returning false when another
   * callback already claimed it. The conditional update is the serialization
   * point that makes a redelivered webhook a no-op.
   */
  public async claimExtraction(id: string): Promise<boolean> {
    const claimed = await prisma.import.updateMany({
      where: { id, extractionCompletedAt: null },
      data: { extractionCompletedAt: new Date() },
    });

    return claimed.count > 0;
  }

  public async softDelete(id: string, userId: string): Promise<void> {
    await prisma.import.update({
      where: { id, userId },
      data: { deleted: true },
    });
  }

  public async updateStatus(
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
