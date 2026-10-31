import { createHandler } from '@/server/http/handler';
import backupService from '@/server/services/backupService';
import { logger } from '@/server/observability';

export const GET = createHandler({
  auth: 'cron',
  heartbeatEnvVar: 'BETTERSTACK_HEARTBEAT_BACKUP_TRANSACTIONS',
  handler: async () => {
    const householdIds = await backupService.getHouseholdsRequiringBackup();
    logger.info({ householdCount: householdIds.length }, 'Starting transaction backup');

    let failed = 0;
    for (const householdId of householdIds) {
      try {
        await backupService.backupTransactionsToCsvAndUpload(householdId);
      } catch (err) {
        failed += 1;
        logger.error({ err, householdId }, 'Failed to back up transactions');
      }
    }

    if (failed > 0) {
      throw new Error(`Backup failed for ${failed} household(s)`);
    }
    return { message: 'Backup completed successfully' };
  },
});
