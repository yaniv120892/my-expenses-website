import { createHandler } from '@/server/http/handler';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

export const GET = createHandler({
  auth: 'cron',
  heartbeat: 'subscriptions-detect',
  handler: async () => subscriptionDetectionService.runDetectionForAllUsers(),
});
