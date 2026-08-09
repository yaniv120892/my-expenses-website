import { createHandler } from '@/server/http/handler';
import { attachFileSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ userId, params }) =>
    transactionService.getTransactionFiles(params.id, userId),
});

export const POST = createHandler({
  auth: 'session',
  bodySchema: attachFileSchema,
  status: 201,
  handler: async ({ userId, body, params }) => {
    await transactionService.attachFile(params.id, userId, body);
    return { success: true };
  },
});
