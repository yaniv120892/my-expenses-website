import { createHandler } from '@/server/http/handler';
import { attachmentParamsSchema } from '@/shared/schemas/common';
import transactionService from '@/server/services/transactionService';

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: attachmentParamsSchema,
  handler: async ({ actor, params }) => {
    await transactionService.removeFile(actor, params.id, params.fileId);
    return { success: true };
  },
});
