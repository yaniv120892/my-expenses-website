import { createHandler } from '@/server/http/handler';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

export const PATCH = createHandler({
  auth: 'session',
  handler: async ({ userId, params }) =>
    subscriptionDetectionService.dismissSubscription(params.id, userId),
});
