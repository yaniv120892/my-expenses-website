import { createHandler } from '@/server/http/handler';
import householdActivityService from '@/server/services/householdActivityService';
import { householdActivityQuerySchema } from '@/shared/schemas/household';

export const GET = createHandler({
  auth: 'session',
  querySchema: householdActivityQuerySchema,
  handler: async ({ actor, query }) =>
    householdActivityService.listPage({
      householdId: actor.householdId,
      cursor: query.cursor,
      limit: query.limit,
    }),
});
