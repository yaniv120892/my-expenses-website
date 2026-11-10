import { createHandler } from '@/server/http/handler';
import { processImportSchema } from '@/shared/schemas/imports';
import { importService } from '@/server/services/importService';
import { captureProductEvent } from '@/server/productEvents';
import {
  householdRateLimitChecks,
  STATEMENT_LIMIT_MESSAGE,
  STATEMENT_PROCESSING_RATE_LIMITS,
} from '@/server/costFences';
import { refuseIfRateLimited } from '@/server/http/guardRefusal';

export const POST = createHandler({
  auth: 'session',
  apiTokenScope: 'IMPORTS',
  bodySchema: processImportSchema,
  handler: async ({ userId, actor, body }) => {
    const refusal = await refuseIfRateLimited({
      checks: householdRateLimitChecks({
        policies: STATEMENT_PROCESSING_RATE_LIMITS,
        householdId: actor.householdId,
      }),
      overLimitMessage: STATEMENT_LIMIT_MESSAGE,
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
