import transactionService from '@/server/services/transactionService';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import { buildTransactionsBackupCsv } from '@/server/utils/transactionCsv';
import { logger } from '@/server/observability';
import backupStorageProviderFactory from '@/server/services/backup/backupStorageProviderFactory';
import userRepository from '@/server/repositories/userRepository';
import { lazy } from '@/server/lib/lazy';

class BackupService {
  private getStorageProvider = lazy(() => backupStorageProviderFactory.getProvider());

  /** Once per household, however many members it has. */
  public async getHouseholdsRequiringBackup(): Promise<HouseholdId[]> {
    return userRepository.findHouseholdsWithVerifiedMembers();
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
}

const backupService = new BackupService();
export default backupService;
