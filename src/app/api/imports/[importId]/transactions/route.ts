import { createHandler } from '@/server/http/handler';
import { importIdParamsSchema } from '@/shared/schemas/params';
import { importService } from '@/server/services/importService';

export const GET = createHandler({
  auth: 'session',
  paramsSchema: importIdParamsSchema,
  handler: async ({ userId, params }) =>
    importService.getImportedTransactions(params.importId, userId),
});
