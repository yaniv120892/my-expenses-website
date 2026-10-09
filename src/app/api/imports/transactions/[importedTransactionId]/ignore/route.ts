import { createHandler } from '@/server/http/handler';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  acceptsImportToken: true,
  handler: async ({ userId, params }) => {
    await importService.ignoreImportedTransaction(
      params.importedTransactionId,
      userId,
    );
    return { success: true };
  },
});
