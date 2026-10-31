import { createHandler } from '@/server/http/handler';
import { importIdParamsSchema } from '@/shared/schemas/common';
import { importService } from '@/server/services/importService';

export const GET = createHandler({
  auth: 'session',
  paramsSchema: importIdParamsSchema,
  apiTokenScope: 'IMPORTS',
  handler: async ({ actor, params }) => importService.getImport(actor.householdId, params.importId),
});

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: importIdParamsSchema,
  handler: async ({ actor, params }) => {
    await importService.deleteImport(actor, params.importId);
    return { success: true };
  },
});
