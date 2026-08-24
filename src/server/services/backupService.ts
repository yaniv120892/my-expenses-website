import transactionService from '@/server/services/transactionService';
import { buildTransactionsBackupCsv } from '@/server/utils/transactionCsv';
import logger from '@/server/logging/logger';
import BackupStorageProviderFactory from '@/server/services/backup/backupStorageProviderFactory';
import userRepository from '@/server/repositories/userRepository';
import { lazy } from '@/server/lib/lazy';

class BackupService {
  private getStorageProvider = lazy(() =>
    BackupStorageProviderFactory.getProvider(),
  );

  public async getUsersRequiredBackup() {
    const users = await userRepository.list({
      isVerified: true,
    });

    return users;
  }

  public async backupTransactionsToCsvAndUpload(userId: string) {
    const transactions = await transactionService.getAllTransactions({
      status: 'APPROVED',
      userId,
    });
    const csv = buildTransactionsBackupCsv(transactions);
    const fileName = `transactions-backup_${userId}-${new Date().toISOString().slice(0, 10)}.csv`;
    const fileBuffer = Buffer.from(csv, 'utf8');
    const mimeType = 'text/csv';
    logger.debug({ fileName }, 'Uploading backup file');
    return this.getStorageProvider().uploadBackup(
      fileName,
      fileBuffer,
      mimeType,
    );
  }
}

export default new BackupService();
