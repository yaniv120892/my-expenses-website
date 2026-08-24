import { createHandler } from '@/server/http/handler';
import { importedTransactionIdParamsSchema } from '@/shared/schemas/params';
import { approveImportedTransactionSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: importedTransactionIdParamsSchema,
  bodySchema: approveImportedTransactionSchema,
  handler: async ({ userId, body, params }) => {
    await importService.approveImportedTransaction(
      params.importedTransactionId,
      userId,
      {
        description: body.description,
        value: body.value,
        date: body.date,
        type: body.type,
        categoryId: body.categoryId ?? null,
      },
    );
    return { success: true };
  },
});
