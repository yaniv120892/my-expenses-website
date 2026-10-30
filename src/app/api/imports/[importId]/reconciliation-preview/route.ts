import { createHandler } from '@/server/http/handler';
import { importIdParamsSchema } from '@/shared/schemas/common';
import { importService } from '@/server/services/importService';

export const GET = createHandler({
  auth: 'session',
  paramsSchema: importIdParamsSchema,
  apiTokenScope: 'IMPORTS',
  handler: async ({ actor, params }) =>
    importService.buildReconciliationPlan(actor.householdId, params.importId),
});
