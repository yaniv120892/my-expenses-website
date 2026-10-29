import { createHandler } from '@/server/http/handler';
import { importIdParamsSchema } from '@/shared/schemas/common';
import { importService } from '@/server/services/importService';

export const GET = createHandler({
  auth: 'session',
  paramsSchema: importIdParamsSchema,
  apiTokenScope: 'IMPORTS',
  handler: async ({ userId, params }) => importService.getImport(params.importId, userId),
});

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: importIdParamsSchema,
  handler: async ({ userId, params }) => {
    await importService.deleteImport(params.importId, userId);
    return { success: true };
  },
});
