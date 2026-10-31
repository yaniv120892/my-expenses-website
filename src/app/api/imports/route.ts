import { createHandler } from '@/server/http/handler';
import { importService } from '@/server/services/importService';

export const GET = createHandler({
  auth: 'session',
  apiTokenScope: 'IMPORTS',
  handler: async ({ actor }) => importService.getImports(actor.householdId),
});
