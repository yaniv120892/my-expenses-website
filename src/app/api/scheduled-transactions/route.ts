import { createHandler } from '@/server/http/handler';
import { createScheduledTransactionSchema } from '@/shared/schemas/scheduledTransactions';
import scheduledTransactionService from '@/server/services/scheduledTransactionService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ actor }) =>
    scheduledTransactionService.listScheduledTransactions(actor.householdId),
});

export const POST = createHandler({
  auth: 'session',
  bodySchema: createScheduledTransactionSchema,
  status: 201,
  handler: async ({ actor, body }) =>
    scheduledTransactionService.createScheduledTransaction(actor, body),
});
