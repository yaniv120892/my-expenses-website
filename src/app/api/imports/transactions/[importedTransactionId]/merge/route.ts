import { createHandler } from '@/server/http/handler';
import { mergeImportedTransactionSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
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
