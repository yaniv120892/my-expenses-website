import transactionService from '@/server/services/transactionService';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import { buildTransactionsBackupCsv } from '@/server/utils/transactionCsv';
import { logger } from '@/server/observability';
import backupStorageProviderFactory from '@/server/services/backup/backupStorageProviderFactory';
import householdRepository from '@/server/repositories/householdRepository';
import { lazy } from '@/server/lib/lazy';
import { optionalEnv } from '@/server/env';

export const BACKUP_HOUSEHOLD_IDS_ENV = 'BACKUP_HOUSEHOLD_IDS';

class BackupService {
  private getStorageProvider = lazy(() => backupStorageProviderFactory.getProvider());

  /**
   * Only the households the owner names: the backup lands in the owner's own storage, so any
   * other household's data must never be copied there.
   */
  public async getHouseholdsRequiringBackup(): Promise<HouseholdId[]> {
    const namedIds = this.namedHouseholdIds();
    if (namedIds.size === 0) {
      logger.warn(
        { envVar: BACKUP_HOUSEHOLD_IDS_ENV },
        'No household is named for backup; backing up nothing',
      );
      return [];
    }
    const eligibleIds = await householdRepository.listIdsWithVerifiedMember();
    const selectedIds = eligibleIds.filter((householdId) => namedIds.has(householdId));
    const unmatchedCount = namedIds.size - selectedIds.length;
    if (unmatchedCount > 0) {
      logger.warn(
        { envVar: BACKUP_HOUSEHOLD_IDS_ENV, unmatchedCount },
        'Some households named for backup have no verified member or do not exist',
      );
    }
    return selectedIds;
  }

  public async backupTransactionsToCsvAndUpload(householdId: HouseholdId) {
    const transactions = await transactionService.getAllTransactions(householdId, {
      status: 'APPROVED',
    });
    const csv = buildTransactionsBackupCsv(transactions);
    const fileName = `transactions-backup_${householdId}-${new Date().toISOString().slice(0, 10)}.csv`;
    const fileBuffer = Buffer.from(csv, 'utf8');
    const mimeType = 'text/csv';
    logger.debug({ fileName }, 'Uploading backup file');
    return this.getStorageProvider().uploadBackup(fileName, fileBuffer, mimeType);
  }

  private namedHouseholdIds(): Set<string> {
    const ids = optionalEnv(BACKUP_HOUSEHOLD_IDS_ENV)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return new Set(ids);
  }
}

const backupService = new BackupService();
export default backupService;
