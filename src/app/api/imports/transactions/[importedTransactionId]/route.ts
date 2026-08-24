import { createHandler } from '@/server/http/handler';
import { importedTransactionIdParamsSchema } from '@/shared/schemas/params';
import { importService } from '@/server/services/importService';

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: importedTransactionIdParamsSchema,
  handler: async ({ userId, params }) => {
    await importService.deleteImportedTransaction(
      params.importedTransactionId,
      userId,
    );
    return { success: true };
  },
});
