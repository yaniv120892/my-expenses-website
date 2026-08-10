import { createHandler } from '@/server/http/handler';
import monthlyReportService from '@/server/services/monthlyReportService';

export const GET = createHandler({
  auth: 'cron',
  handler: async () => monthlyReportService.sendMonthlyReportToAllUsers(),
});
