import { createHandler } from '@/server/http/handler';
import { idParamsSchema } from '@/shared/schemas/common';
import { convertSubscriptionSchema } from '@/shared/schemas/subscriptions';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

export const POST = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  bodySchema: convertSubscriptionSchema,
  handler: async ({ actor, body, params }) =>
    subscriptionDetectionService.convertToScheduledTransaction(actor, params.id, body.categoryId),
});
