import { createHandler } from '@/server/http/handler';
import { importService } from '@/server/services/importService';

export const DELETE = createHandler({
  auth: 'session',
  acceptsImportToken: true,
  handler: async ({ userId, params }) => {
    await importService.deleteImportedTransaction(
      params.importedTransactionId,
      userId,
    );
    return { success: true };
  },
});
