import type { Import } from '@/generated/prisma/client';
import { ImportStatus } from '@/generated/prisma/client';
import { systemPrisma } from '@/server/db/client';
import type { ScheduledHouseholdTransaction } from '@/server/repositories/scheduledTransactionRepository.types';
import { toScheduledHouseholdTransaction } from '@/server/repositories/scheduledTransactionRepository';

// Longer than the platform lets any function run, so a claim older than this
// belongs to a callback that died mid-write.
const CALLBACK_CLAIM_GRACE_MS = 15 * 60 * 1000;

type StuckImportSweep = { importIds: string[]; failedCount: number };

/**
 * The only queries that skip the household scope check, each for a job that
 * cannot name a household up front. Every other query belongs in a repository
 * that takes one.
 */
class CrossHouseholdRepository {
  /** The extraction callback names only the import, and learns its household from the row. */
  public async findImportForExtractionCallback({
    importId,
    excelExtractionRequestId,
  }: {
    importId: string | null;
    excelExtractionRequestId: string;
  }): Promise<Import | null> {
    return systemPrisma.import.findUnique({
      where: importId ? { id: importId } : { excelExtractionRequestId },
    });
  }

  /**
   * The write is scoped to PROCESSING again, so a callback that completes or
   * merges an import between the read and the write keeps its status. It claims
   * the extraction too, so a callback signed moments before the cutoff is a
   * no-op rather than rows written into a FAILED import. A callback that has
   * claimed the extraction is left to finish unless its claim has outlived any
   * function.
   */
  public async failStuckImports(createdBefore: Date, error: string): Promise<StuckImportSweep> {
    const stuck = await systemPrisma.import.findMany({
      where: {
        status: ImportStatus.PROCESSING,
        createdAt: { lt: createdBefore },
      },
      select: { id: true },
    });
    const importIds = stuck.map((stuckImport) => stuckImport.id);
    if (importIds.length === 0) {
      return { importIds, failedCount: 0 };
    }
    const claimedBefore = new Date(Date.now() - CALLBACK_CLAIM_GRACE_MS);
    const failed = await systemPrisma.import.updateMany({
      where: {
        id: { in: importIds },
        status: ImportStatus.PROCESSING,
        OR: [{ extractionCompletedAt: null }, { extractionCompletedAt: { lt: claimedBefore } }],
      },
      data: {
        status: ImportStatus.FAILED,
        error,
        extractionCompletedAt: new Date(),
      },
    });
    return { importIds, failedCount: failed.count };
  }

  public async findDueScheduledTransactions(date: Date): Promise<ScheduledHouseholdTransaction[]> {
    const scheduledTransactions = await systemPrisma.scheduledTransaction.findMany({
      where: {
        nextRunDate: { lte: date },
      },
    });
    return scheduledTransactions.map(toScheduledHouseholdTransaction);
  }
}

const crossHouseholdRepository = new CrossHouseholdRepository();
export default crossHouseholdRepository;
