import { createHandler } from '@/server/http/handler';
import { idParamsSchema } from '@/shared/schemas/common';
import { updateTransactionStatusSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';

export const PATCH = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  bodySchema: updateTransactionStatusSchema,
  handler: async ({ actor, body, params }) =>
    transactionService.updateTransactionStatus(actor, params.id, body.status),
});
