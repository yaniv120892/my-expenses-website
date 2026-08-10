import { createHandler } from '@/server/http/handler';
import { getCategoryComparisonQuerySchema } from '@/shared/schemas/trends';
import categoryComparisonService from '@/server/services/categoryComparisonService';

export const GET = createHandler({
  auth: 'session',
  querySchema: getCategoryComparisonQuerySchema,
  handler: async ({ userId, query }) =>
    categoryComparisonService.getCategoryComparison(query, userId),
});
