import { createHandler } from '@/server/http/handler';
import monthlyReportService from '@/server/services/monthlyReportService';
import { logger } from '@/server/observability';
import type { TestMonthlyReportResult } from '@/shared/types/testMonthlyReport';

export const POST = createHandler({
  auth: 'session',
  writes: 'ownAccount',
  handler: async ({ userId }): Promise<TestMonthlyReportResult> => {
    try {
      const outcome = await monthlyReportService.sendMonthlyReportForUser(userId, {
        sendWhenEmpty: true,
      });
      if (!outcome.sent || !outcome.recipient) {
        return { status: 'NOT_BUILT' };
      }
      return {
        status: 'SENT',
        month: outcome.month,
        recipient: outcome.recipient,
        transactionCount: outcome.transactionCount,
      };
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to send test monthly report');
      return { status: 'FAILED' };
    }
  },
});
