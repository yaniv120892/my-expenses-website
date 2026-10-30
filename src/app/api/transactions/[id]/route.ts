import { createHandler } from '@/server/http/handler';
import { idParamsSchema } from '@/shared/schemas/common';
import { updateTransactionSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';
import { captureProductEvent } from '@/server/productEvents';

export const PUT = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  bodySchema: updateTransactionSchema,
  handler: async ({ userId, actor, body, params }) => {
    await transactionService.updateTransaction(actor, params.id, body);
    captureProductEvent({ userId, event: 'transaction_updated', properties: { channel: 'web' } });
  },
});

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  handler: async ({ userId, actor, params }) => {
    await transactionService.deleteTransaction(actor, params.id);
    captureProductEvent({ userId, event: 'transaction_deleted', properties: { channel: 'web' } });
  },
});
