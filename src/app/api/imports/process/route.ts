import { createHandler } from '@/server/http/handler';
import { processImportSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';
import { captureProductEvent } from '@/server/productEvents';

export const POST = createHandler({
  auth: 'session',
  apiTokenScope: 'IMPORTS',
  bodySchema: processImportSchema,
  handler: async ({ userId, body }) => {
    const result = await importService.processImport(
      body.fileUrl,
      userId,
      body.originalFileName,
      body.paymentMonth,
    );
    captureProductEvent({ userId, event: 'statement_uploaded' });
    return result;
  },
});
