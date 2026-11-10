import { createHandler } from '@/server/http/handler';
import { importIdParamsSchema } from '@/shared/schemas/common';
import { importService } from '@/server/services/importService';
import { STATEMENT_PROCESSING_RATE_LIMITS } from '@/server/costFences';
import { refuseIfStatementLimited } from '@/server/http/guardRefusal';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: importIdParamsSchema,
  handler: async ({ actor, params }) => {
    const refusal = await refuseIfStatementLimited({
      policies: STATEMENT_PROCESSING_RATE_LIMITS,
      householdId: actor.householdId,
    });
    if (refusal) {
      return refusal;
    }
    await importService.rematchImport(actor, params.importId);
    return { success: true };
  },
});
