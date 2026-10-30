import { createHandler } from '@/server/http/handler';
import { getSpendingTrendsQuerySchema } from '@/shared/schemas/trends';
import trendService from '@/server/services/trendService';

export const GET = createHandler({
  auth: 'session',
  querySchema: getSpendingTrendsQuerySchema,
  handler: async ({ actor, query }) =>
    trendService.getSpendingTrends(
      {
        startDate: query.startDate,
        endDate: query.endDate,
        period: query.period,
        categoryId: query.categoryId,
        transactionType: query.transactionType,
      },
      actor.householdId,
    ),
});
