import { createHandler } from '@/server/http/handler';
import { importIdParamsSchema } from '@/shared/schemas/common';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: importIdParamsSchema,
  handler: async ({ actor, params }) => importService.applyAutoApproveRules(actor, params.importId),
});
