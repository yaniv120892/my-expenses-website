import { createHandler } from '@/server/http/handler';
import { updateScheduledTransactionSchema } from '@/shared/schemas/scheduledTransactions';
import scheduledTransactionService from '@/server/services/scheduledTransactionService';

export const PUT = createHandler({
  auth: 'session',
  bodySchema: updateScheduledTransactionSchema,
  handler: async ({ userId, body, params }) =>
    scheduledTransactionService.updateScheduledTransaction(
      params.id,
      body,
      userId,
    ),
});

export const DELETE = createHandler({
  auth: 'session',
  status: 204,
  handler: async ({ userId, params }) => {
    await scheduledTransactionService.deleteScheduledTransaction(
      params.id,
      userId,
    );
  },
});
