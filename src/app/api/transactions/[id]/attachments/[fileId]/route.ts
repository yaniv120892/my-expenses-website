import { createHandler } from '@/server/http/handler';
import { attachmentParamsSchema } from '@/shared/schemas/params';
import transactionService from '@/server/services/transactionService';

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: attachmentParamsSchema,
  handler: async ({ userId, params }) => {
    await transactionService.removeFile(params.id, params.fileId, userId);
    return { success: true };
  },
});
