import type {
  Prisma,
  Import,
  ImportFileType,
  ImportBankSourceType,
} from '@/generated/prisma/client';
import { ImportStatus, ImportedTransactionStatus } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';

export type ImportWithPendingCount = Import & {
  _count: {
    transactions: number;
  };
  mergedInto: { originalFileName: string } | null;
};

const listItemInclude = {
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
  mergedInto: { select: { originalFileName: true } },
} as const;

export class ImportRepository {
  public async create(data: {
    fileUrl: string;
    originalFileName: string;
    importType: ImportFileType | null;
    bankSourceType: ImportBankSourceType | null;
    householdId: HouseholdId;
    userId: string | null;
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

  public async findById(householdId: HouseholdId, id: string): Promise<Import | null> {
    return prisma.import.findUnique({
      where: { id, householdId },
    });
  }

  public async findByHousehold(householdId: HouseholdId): Promise<ImportWithPendingCount[]> {
    return prisma.import.findMany({
      where: { householdId, deleted: false },
      // id breaks createdAt ties so the polled list keeps a stable order.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: listItemInclude,
    });
  }

  public async findLiveById(
    householdId: HouseholdId,
    id: string,
  ): Promise<ImportWithPendingCount | null> {
    return prisma.import.findFirst({
      where: { id, householdId, deleted: false },
      include: listItemInclude,
    });
  }

  /**
   * COMPLETED, so a merge never dedupes against rows still being written and
   * two racing callbacks never find each other; oldest, so the choice among
   * several is stable.
   */
  public async findExisting(
    householdId: HouseholdId,
    paymentMonth: string,
    creditCardLastFourDigits: string,
    excludeImportId?: string,
  ): Promise<Import | null> {
    const imports = await prisma.import.findMany({
      where: {
        householdId,
        paymentMonth,
        deleted: false,
        status: ImportStatus.COMPLETED,
        ...(excludeImportId ? { id: { not: excludeImportId } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    // creditCardLastFourDigits is encrypted at rest with a random IV and
    // decrypted on read, so matching must happen in memory, not in the query.
    for (const imp of imports) {
      if (imp.creditCardLastFourDigits === creditCardLastFourDigits) {
        return imp;
      }
    }

    return null;
  }

  /** The conditional update is what makes a redelivered webhook a no-op. */
  public async claimExtraction(householdId: HouseholdId, id: string): Promise<boolean> {
    const claimed = await prisma.import.updateMany({
      where: { id, householdId, extractionCompletedAt: null },
      data: { extractionCompletedAt: new Date() },
    });

    return claimed.count > 0;
  }

  public softDeleteOp(householdId: HouseholdId, id: string) {
    return prisma.import.update({
      where: { id, householdId },
      data: { deleted: true },
    });
  }

  /**
   * Conditional, so a crash after this import was merged away or completed
   * leaves that status alone rather than overwriting it with FAILED.
   */
  public async markFailedIfProcessing(
    householdId: HouseholdId,
    id: string,
    error: string,
  ): Promise<boolean> {
    const failed = await prisma.import.updateMany({
      where: { id, householdId, status: ImportStatus.PROCESSING },
      data: { status: ImportStatus.FAILED, error },
    });
    return failed.count > 0;
  }

  /**
   * Conditional, so a writer that moved the import on first keeps its status;
   * false when the import was not in `from`.
   */
  public async transitionStatus(
    householdId: HouseholdId,
    id: string,
    from: ImportStatus,
    to: ImportStatus,
  ): Promise<boolean> {
    const moved = await prisma.import.updateMany({
      where: { id, householdId, status: from },
      data: {
        status: to,
        ...(to === ImportStatus.COMPLETED && { completedAt: new Date() }),
      },
    });
    return moved.count > 0;
  }

  public async updateStatus(
    householdId: HouseholdId,
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
      where: { id, householdId },
      data,
    });
  }
}

export const importRepository = new ImportRepository();
