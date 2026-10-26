import { getLocale } from '@yaniv120892/my-ui/server';
import { createHandler } from '@/server/http/handler';
import dashboardService from '@/server/services/dashboardService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ userId }) =>
    dashboardService.getInsights({ userId, locale: await getLocale() }),
});
