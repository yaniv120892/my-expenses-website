import { createHandler } from '@/server/http/handler';
import { idParamsSchema } from '@/shared/schemas/params';
import { updateTransactionStatusSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';

export const PATCH = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  bodySchema: updateTransactionStatusSchema,
  handler: async ({ userId, body, params }) =>
    transactionService.updateTransactionStatus(params.id, body.status, userId),
});
