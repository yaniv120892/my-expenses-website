import { createHandler } from '@/server/http/handler';
import monthlyReportService from '@/server/services/monthlyReportService';

export const GET = createHandler({
  auth: 'cron',
  heartbeatEnvVar: 'BETTERSTACK_HEARTBEAT_REPORTS_MONTHLY',
  handler: async () => monthlyReportService.sendMonthlyReportToAllUsers(),
});
