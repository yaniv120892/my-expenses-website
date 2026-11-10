import { createHandler } from '@/server/http/handler';
import { processImportSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';
import { captureProductEvent } from '@/server/productEvents';
import { STATEMENT_PROCESSING_RATE_LIMITS } from '@/server/costFences';
import { refuseIfStatementLimited } from '@/server/http/guardRefusal';

export const POST = createHandler({
  auth: 'session',
  apiTokenScope: 'IMPORTS',
  bodySchema: processImportSchema,
  handler: async ({ userId, actor, body }) => {
    const refusal = await refuseIfStatementLimited({
      policies: STATEMENT_PROCESSING_RATE_LIMITS,
      householdId: actor.householdId,
    });
    if (refusal) {
      return refusal;
    }
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
