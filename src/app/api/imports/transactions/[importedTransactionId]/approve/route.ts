import { createHandler } from '@/server/http/handler';
import { importedTransactionIdParamsSchema } from '@/shared/schemas/common';
import { approveImportedTransactionSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: importedTransactionIdParamsSchema,
  apiTokenScope: 'IMPORTS',
  bodySchema: approveImportedTransactionSchema,
  handler: async ({ actor, body, params }) => {
    await importService.approveImportedTransaction(actor, params.importedTransactionId, {
      description: body.description,
      value: body.value,
      date: body.date,
      type: body.type,
      categoryId: body.categoryId ?? null,
    });
    return { success: true };
  },
});
