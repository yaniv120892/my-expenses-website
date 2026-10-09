import { createHandler } from '@/server/http/handler';
import { importService } from '@/server/services/importService';

export const POST = createHandler({
  auth: 'session',
  handler: async ({ userId, params }) =>
    importService.applyAutoApproveRules(params.importId, userId),
});
