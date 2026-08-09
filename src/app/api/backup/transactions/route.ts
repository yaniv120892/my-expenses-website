import { createHandler } from '@/server/http/handler';
import backupService from '@/server/services/backupService';
import logger from '@/server/logging/logger';

export const GET = createHandler({
  auth: 'cron',
  handler: async () => {
    const users = await backupService.getUsersRequiredBackup();
    logger.info(
      { userCount: users?.length ?? 0 },
      'Starting transaction backup',
    );

    let failed = 0;
    for (const user of users ?? []) {
      // Guarded per user so one failing backup cannot abort the rest.
      try {
        await backupService.backupTransactionsToCsvAndUpload(user.id);
      } catch (err) {
        failed += 1;
        logger.error(
          { err, userId: user.id },
          'Failed to back up transactions',
        );
      }
    }

    if (failed > 0) {
      // Surface partial failure so cron monitoring and Sentry see it.
      throw new Error(`Backup failed for ${failed} user(s)`);
    }
    return { message: 'Backup completed successfully' };
  },
});
