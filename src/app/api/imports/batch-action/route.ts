import { createHandler } from '@/server/http/handler';
import { batchActionSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  bodySchema: batchActionSchema,
  handler: async ({ userId, body }) => {
    const transactionIds = body.transactionIds || 'all';
    if (body.action === 'approve') {
      return importService.batchApproveImportedTransactions(
        body.importId,
        transactionIds,
        userId,
      );
    }
    return importService.batchIgnoreImportedTransactions(
      body.importId,
      transactionIds,
      userId,
    );
  },
});
