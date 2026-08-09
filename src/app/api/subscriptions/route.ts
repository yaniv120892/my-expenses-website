import { createHandler } from '@/server/http/handler';
import { getSubscriptionsQuerySchema } from '@/shared/schemas/subscriptions';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ req, userId }) => {
    // Parsed here because the schema's input (query strings) differs from its
    // output, which the factory's single-generic ZodType cannot express.
    const query = getSubscriptionsQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    return subscriptionDetectionService.getSubscriptions(userId, query.status);
  },
});
