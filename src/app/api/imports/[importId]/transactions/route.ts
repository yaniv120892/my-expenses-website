import { createHandler } from '@/server/http/handler';
import { importService } from '@/server/services/importService';

export const GET = createHandler({
  auth: 'session',
  acceptsImportToken: true,
  handler: async ({ userId, params }) =>
    importService.getImportedTransactions(params.importId, userId),
});
