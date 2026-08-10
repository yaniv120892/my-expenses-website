import { createHandler } from '@/server/http/handler';
import { getSubscriptionsQuerySchema } from '@/shared/schemas/subscriptions';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

export const GET = createHandler({
  auth: 'session',
  querySchema: getSubscriptionsQuerySchema,
  handler: async ({ userId, query }) =>
    subscriptionDetectionService.getSubscriptions(userId, query.status),
});
