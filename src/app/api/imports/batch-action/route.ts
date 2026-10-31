import { createHandler } from '@/server/http/handler';
import { batchActionSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  apiTokenScope: 'IMPORTS',
  bodySchema: batchActionSchema,
  handler: async ({ actor, body }) => {
    const transactionIds = body.transactionIds || 'all';
    if (body.action === 'approve') {
      return importService.batchApproveImportedTransactions(actor, body.importId, transactionIds);
    }
    return importService.batchIgnoreImportedTransactions(actor, body.importId, transactionIds);
  },
});
