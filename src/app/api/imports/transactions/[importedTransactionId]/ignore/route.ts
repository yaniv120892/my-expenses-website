import { createHandler } from '@/server/http/handler';
import { importedTransactionIdParamsSchema } from '@/shared/schemas/common';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: importedTransactionIdParamsSchema,
  handler: async ({ actor, params }) => {
    await importService.ignoreImportedTransaction(actor, params.importedTransactionId);
    return { success: true };
  },
});
