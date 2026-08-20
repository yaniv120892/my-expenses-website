import { createHandler } from '@/server/http/handler';
import subscriptionDetectionService from '@/server/services/subscriptionDetectionService';

export const GET = createHandler({
  auth: 'cron',
  heartbeatEnvVar: 'BETTERSTACK_HEARTBEAT_SUBSCRIPTIONS_AUDIT_NOTIFY',
  handler: async () =>
    subscriptionDetectionService.sendMonthlyAuditNotifications(),
});
