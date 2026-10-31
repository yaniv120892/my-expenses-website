import { createHandler } from '@/server/http/handler';
import { processImportSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';
import { captureProductEvent } from '@/server/productEvents';

export const POST = createHandler({
  auth: 'session',
  apiTokenScope: 'IMPORTS',
  bodySchema: processImportSchema,
  handler: async ({ userId, actor, body }) => {
    const result = await importService.processImport(
      actor,
      body.fileUrl,
      body.originalFileName,
      body.paymentMonth,
    );
    captureProductEvent({ userId, event: 'statement_uploaded' });
    return result;
  },
});
