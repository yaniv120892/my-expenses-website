import { createHandler } from '@/server/http/handler';
import { getCategorySpendingTrendsQuerySchema } from '@/shared/schemas/trends';
import trendService from '@/server/services/trendService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ req, userId }) => {
    // Parsed here because the schema's input (query strings) differs from its
    // output, which the factory's single-generic ZodType cannot express.
    const query = getCategorySpendingTrendsQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    return trendService.getCategorySpendingTrends(
      {
        startDate: query.startDate,
        endDate: query.endDate,
        period: query.period,
        transactionType: query.transactionType,
      },
      userId,
    );
  },
});
