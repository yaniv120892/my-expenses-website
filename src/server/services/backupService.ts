import transactionService from '@/server/services/transactionService';
import { Transaction } from '@/shared/types/transaction';
import { parse } from 'json2csv';
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
    const csvRows = transactions.map((t: Transaction) => ({
      date: t.date,
      description: t.description,
      value: t.value,
      type: t.type,
      categoryName: t.category.name,
    }));
    const csv = parse(csvRows, {
      fields: ['date', 'description', 'value', 'type', 'categoryName'],
    });
    const fileName = `transactions-backup_${userId}-${new Date().toISOString().slice(0, 10)}.csv`;
    const fileBuffer = Buffer.from(csv, 'utf8');
    const mimeType = 'text/csv';
    logger.debug(`Uploading backup file: ${fileName}`);
    return this.getStorageProvider().uploadBackup(
      fileName,
      fileBuffer,
      mimeType,
    );
  }
}

export default new BackupService();
