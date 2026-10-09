import { createHandler } from '@/server/http/handler';
import { importService } from '@/server/services/importService';

export const GET = createHandler({
  auth: 'session',
  acceptsImportToken: true,
  handler: async ({ userId }) => importService.getImports(userId),
});
