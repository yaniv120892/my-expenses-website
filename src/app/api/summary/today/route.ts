import { createHandler } from '@/server/http/handler';
import summaryService from '@/server/services/summaryService';

export const GET = createHandler({
  auth: 'cron',
  handler: async () => summaryService.sendTodaySummaryToAllUsers(),
});
