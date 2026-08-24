import { createHandler } from '@/server/http/handler';
import { importedTransactionIdParamsSchema } from '@/shared/schemas/params';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: importedTransactionIdParamsSchema,
  handler: async ({ userId, params }) => {
    await importService.ignoreImportedTransaction(
      params.importedTransactionId,
      userId,
    );
    return { success: true };
  },
});
