import { createHandler } from '@/server/http/handler';
import monthlyReportService from '@/server/services/monthlyReportService';
import { logger } from '@/server/observability';
import type { TestMonthlyReportResult } from '@/shared/types/testMonthlyReport';
import { TEST_MONTHLY_REPORT_RATE_LIMIT } from '@/server/costFences';
import { refuseIfRateLimited } from '@/server/http/guardRefusal';

export const POST = createHandler({
  auth: 'session',
  writes: 'ownAccount',
  handler: async ({ userId, actor }): Promise<TestMonthlyReportResult | Response> => {
    const refusal = await refuseIfRateLimited({
      checks: [{ policy: TEST_MONTHLY_REPORT_RATE_LIMIT, clientId: `user:${userId}` }],
      overLimitMessage: 'Too many test reports. Try again in an hour.',
    });
    if (refusal) {
      return refusal;
    }
    try {
      const outcome = await monthlyReportService.sendMonthlyReportForUser({
        userId,
        householdId: actor.householdId,
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
