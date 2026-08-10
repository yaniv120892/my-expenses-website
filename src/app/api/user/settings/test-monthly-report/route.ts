import { createHandler } from '@/server/http/handler';
import monthlyReportService from '@/server/services/monthlyReportService';
import logger from '@/server/logging/logger';

export const POST = createHandler({
  auth: 'session',
  handler: async ({ userId }) => {
    try {
      // sendWhenEmpty: the scheduled run skips an empty month, but a test that
      // silently sends nothing is indistinguishable from a broken setup.
      const outcome = await monthlyReportService.sendMonthlyReportForUser(
        userId,
        { sendWhenEmpty: true },
      );

      if (!outcome.sent) {
        return {
          success: false,
          message: 'Could not build the report for your account.',
        };
      }

      if (outcome.transactionCount === 0) {
        return {
          success: true,
          message: `${outcome.monthLabel} report sent to ${outcome.recipient}. That month had no transactions, so the scheduled monthly email would have skipped it.`,
        };
      }

      return {
        success: true,
        message: `${outcome.monthLabel} report sent to ${outcome.recipient}.`,
      };
    } catch (error) {
      logger.error({ userId, error }, 'Failed to send test monthly report');
      return {
        success: false,
        message:
          'Could not send the report. Please check the email configuration.',
      };
    }
  },
});
