import { createHandler } from '@/server/http/handler';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

export const GET = createHandler({
  auth: 'cron',
  handler: async () =>
    subscriptionDetectionService.sendMonthlyAuditNotifications(),
});
