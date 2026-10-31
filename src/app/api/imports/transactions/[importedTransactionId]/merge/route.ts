import { createHandler } from '@/server/http/handler';
import { importedTransactionIdParamsSchema } from '@/shared/schemas/common';
import { mergeImportedTransactionSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: importedTransactionIdParamsSchema,
  bodySchema: mergeImportedTransactionSchema,
  handler: async ({ actor, body, params }) => {
    await importService.mergeImportedTransaction(actor, params.importedTransactionId, body);
    return { success: true };
  },
});
