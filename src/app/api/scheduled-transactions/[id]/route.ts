import { createHandler } from '@/server/http/handler';
import { idParamsSchema } from '@/shared/schemas/common';
import { updateScheduledTransactionSchema } from '@/shared/schemas/scheduledTransactions';
import scheduledTransactionService from '@/server/services/scheduledTransactionService';

export const PUT = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  bodySchema: updateScheduledTransactionSchema,
  handler: async ({ actor, body, params }) =>
    scheduledTransactionService.updateScheduledTransaction(actor, params.id, body),
});

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  status: 204,
  handler: async ({ actor, params }) => {
    await scheduledTransactionService.deleteScheduledTransaction(actor, params.id);
  },
});
