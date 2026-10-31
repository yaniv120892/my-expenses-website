import { createHandler } from '@/server/http/handler';
import { importedTransactionIdParamsSchema } from '@/shared/schemas/common';
import { importService } from '@/server/services/importService';

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: importedTransactionIdParamsSchema,
  handler: async ({ actor, params }) => {
    await importService.deleteImportedTransaction(actor, params.importedTransactionId);
    return { success: true };
  },
});
