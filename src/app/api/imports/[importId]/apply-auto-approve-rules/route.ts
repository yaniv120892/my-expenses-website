import { createHandler } from '@/server/http/handler';
import { importIdParamsSchema } from '@/shared/schemas/params';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: importIdParamsSchema,
  handler: async ({ userId, params }) =>
    importService.applyAutoApproveRules(params.importId, userId),
});
