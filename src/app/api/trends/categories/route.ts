import { createHandler } from '@/server/http/handler';
import { getCategorySpendingTrendsQuerySchema } from '@/shared/schemas/trends';
import trendService from '@/server/services/trendService';

export const GET = createHandler({
  auth: 'session',
  querySchema: getCategorySpendingTrendsQuerySchema,
  handler: async ({ userId, query }) =>
    trendService.getCategorySpendingTrends(
      {
        startDate: query.startDate,
        endDate: query.endDate,
        period: query.period,
        transactionType: query.transactionType,
      },
      userId,
    ),
});
