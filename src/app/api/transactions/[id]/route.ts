import { createHandler } from '@/server/http/handler';
import { idParamsSchema } from '@/shared/schemas/params';
import { updateTransactionSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';

export const PUT = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  bodySchema: updateTransactionSchema,
  handler: async ({ userId, body, params }) =>
    transactionService.updateTransaction(params.id, body, userId),
});

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  handler: async ({ userId, params }) => {
    await transactionService.deleteTransaction(params.id, userId);
  },
});
