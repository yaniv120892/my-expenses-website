import { createHandler } from '@/server/http/handler';
import transactionService from '@/server/services/transactionService';

export const DELETE = createHandler({
  auth: 'session',
  handler: async ({ userId, params }) => {
    await transactionService.removeFile(params.id, params.fileId, userId);
    return { success: true };
  },
});
