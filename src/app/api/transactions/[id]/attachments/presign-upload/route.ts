import { createHandler } from '@/server/http/handler';
import { idParamsSchema } from '@/shared/schemas/common';
import { getPresignedUploadUrlSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  bodySchema: getPresignedUploadUrlSchema,
  handler: async ({ userId, body, params }) =>
    transactionService.getPresignedUploadUrl(params.id, userId, body),
});
