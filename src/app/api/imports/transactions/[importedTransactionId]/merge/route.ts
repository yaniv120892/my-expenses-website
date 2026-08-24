import { createHandler } from '@/server/http/handler';
import { importedTransactionIdParamsSchema } from '@/shared/schemas/params';
import { mergeImportedTransactionSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: importedTransactionIdParamsSchema,
  bodySchema: mergeImportedTransactionSchema,
  handler: async ({ userId, body, params }) => {
    await importService.mergeImportedTransaction(
      params.importedTransactionId,
      userId,
      body,
    );
    return { success: true };
  },
});
