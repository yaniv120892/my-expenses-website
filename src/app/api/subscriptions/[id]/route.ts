import { createHandler } from '@/server/http/handler';
import { updateSubscriptionSchema } from '@/shared/schemas/subscriptions';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

export const PATCH = createHandler({
  auth: 'session',
  bodySchema: updateSubscriptionSchema,
  handler: async ({ userId, body, params }) =>
    subscriptionDetectionService.updateSubscription(params.id, userId, body),
});
