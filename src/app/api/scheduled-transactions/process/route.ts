import { createHandler } from '@/server/http/handler';
import scheduledTransactionService from '@/server/services/scheduledTransactionService';

export const GET = createHandler({
  auth: 'cron',
  heartbeat: 'scheduled-transactions-process',
  handler: async () =>
    scheduledTransactionService.processDueScheduledTransactions(new Date()),
});
