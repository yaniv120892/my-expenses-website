import { createHandler } from '@/server/http/handler';
import scheduledTransactionService from '@/server/services/scheduledTransactionService';

export const GET = createHandler({
  auth: 'cron',
  heartbeatEnvVar: 'BETTERSTACK_HEARTBEAT_SCHEDULED_TRANSACTIONS_PROCESS',
  handler: async () =>
    scheduledTransactionService.processDueScheduledTransactions(new Date()),
});
