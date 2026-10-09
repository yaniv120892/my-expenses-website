import { createHandler } from '@/server/http/handler';
import { processImportSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  apiTokenScope: 'IMPORTS',
  bodySchema: processImportSchema,
  handler: async ({ userId, body }) =>
    importService.processImport(
      body.fileUrl,
      userId,
      body.originalFileName,
      body.paymentMonth,
    ),
});
