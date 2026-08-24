import { createHandler } from '@/server/http/handler';
import { idParamsSchema } from '@/shared/schemas/params';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

export const PATCH = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  handler: async ({ userId, params }) =>
    subscriptionDetectionService.dismissSubscription(params.id, userId),
});
