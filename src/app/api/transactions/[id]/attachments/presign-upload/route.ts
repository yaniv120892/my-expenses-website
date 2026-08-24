import { createHandler } from '@/server/http/handler';
import { getPresignedUploadUrlSchema } from '@/shared/schemas/transactions';
import transactionService from '@/server/services/transactionService';

export const POST = createHandler({
  auth: 'session',
  bodySchema: getPresignedUploadUrlSchema,
  handler: async ({ userId, body, params }) =>
    transactionService.getPresignedUploadUrl(
      params.id,
      userId,
      body.fileName,
      body.mimeType,
    ),
});
