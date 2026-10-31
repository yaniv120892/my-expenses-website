import { createHandler } from '@/server/http/handler';
import transactionService from '@/server/services/transactionService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ actor }) => transactionService.getPendingTransactions(actor.householdId),
});
