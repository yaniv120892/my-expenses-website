import { createHandler } from '@/server/http/handler';
import { idParamsSchema } from '@/shared/schemas/common';
import { attachFileSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';

export const GET = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  handler: async ({ actor, params }) =>
    transactionService.getTransactionFiles(actor.householdId, params.id),
});

export const POST = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  bodySchema: attachFileSchema,
  status: 201,
  handler: async ({ actor, body, params }) => {
    await transactionService.attachFile(actor, params.id, body);
    return { success: true };
  },
});
