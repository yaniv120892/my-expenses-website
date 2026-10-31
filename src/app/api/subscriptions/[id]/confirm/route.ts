import { createHandler } from '@/server/http/handler';
import { idParamsSchema } from '@/shared/schemas/common';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

export const PATCH = createHandler({
  auth: 'session',
  paramsSchema: idParamsSchema,
  handler: async ({ actor, params }) =>
    subscriptionDetectionService.confirmSubscription(actor, params.id),
});
