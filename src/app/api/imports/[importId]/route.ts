import { createHandler } from '@/server/http/handler';
import { importService } from '@/server/services/importService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ userId, params }) =>
    importService.getImport(params.importId, userId),
});

export const DELETE = createHandler({
  auth: 'session',
  handler: async ({ userId, params }) => {
    await importService.deleteImport(params.importId, userId);
    return { success: true };
  },
});
