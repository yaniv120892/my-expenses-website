import { createHandler } from '@/server/http/handler';
import { updateTransactionStatusSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';

export const PATCH = createHandler({
  auth: 'session',
  bodySchema: updateTransactionStatusSchema,
  handler: async ({ userId, body, params }) =>
    transactionService.updateTransactionStatus(params.id, body.status, userId),
});
