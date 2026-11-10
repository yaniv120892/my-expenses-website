import { createHandler } from '@/server/http/handler';
import { importIdParamsSchema } from '@/shared/schemas/common';
import { importService } from '@/server/services/importService';
import {
  householdRateLimitChecks,
  STATEMENT_LIMIT_MESSAGE,
  STATEMENT_PROCESSING_RATE_LIMITS,
} from '@/server/costFences';
import { refuseIfRateLimited } from '@/server/http/guardRefusal';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: importIdParamsSchema,
  handler: async ({ actor, params }) => {
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
    await importService.rematchImport(actor, params.importId);
    return { success: true };
  },
});
