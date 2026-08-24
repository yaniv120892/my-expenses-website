import { createHandler } from '@/server/http/handler';
import { idParamsSchema } from '@/shared/schemas/params';
import { convertSubscriptionSchema } from '@/shared/schemas/subscriptions';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  bodySchema: convertSubscriptionSchema,
  handler: async ({ userId, body, params }) =>
    subscriptionDetectionService.convertToScheduledTransaction(
      params.id,
      userId,
      body.categoryId,
    ),
});
