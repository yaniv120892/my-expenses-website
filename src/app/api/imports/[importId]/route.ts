import { createHandler } from '@/server/http/handler';
import { importIdParamsSchema } from '@/shared/schemas/params';
import { importService } from '@/server/services/importService';

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: importIdParamsSchema,
  handler: async ({ userId, params }) => {
    await importService.deleteImport(params.importId, userId);
    return { success: true };
  },
});
