import { createHandler } from '@/server/http/handler';
import backupService from '@/server/services/backupService';
import logger from '@/server/logging/logger';

async function getUsersRequiredBackup(): Promise<string[]> {
  const users = await backupService.getUsersRequiredBackup();
  if (!users || users.length === 0) {
    logger.info('No users require backup');
    return [];
  }
  logger.info(`Found ${users.length} users requiring backup`);
  return users.map((user: { id: string }) => user.id);
}

export const GET = createHandler({
  auth: 'cron',
  handler: async () => {
    try {
      logger.info('Starting backup of transactions');
      const usersRequiredBackup = await getUsersRequiredBackup();
      for (const userId of usersRequiredBackup) {
        await backupService.backupTransactionsToCsvAndUpload(userId);
        logger.info(`Done backing up transactions for user ${userId}`);
      }
      return { message: 'Backup completed successfully' };
    } catch (error) {
      logger.error({ error }, 'Failed to backup transactions');
      return { message: 'Failed to backup transactions' };
    }
  },
});
