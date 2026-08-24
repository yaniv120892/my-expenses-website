import { createHandler } from '@/server/http/handler';
import { testTelegramSchema } from '@/shared/schemas/userSettings';
import { telegramService } from '@/server/services/telegramService';
import logger from '@/server/logging/logger';
import { enforceRateLimit } from '@/server/http/rateLimit';

function extractTestTelegramFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes('chat not found')) {
    return 'Chat not found. Please check your chat ID.';
  }
  return 'Unknown error. Please check your chat ID.';
}

export const POST = createHandler({
  auth: 'session',
  bodySchema: testTelegramSchema,
  handler: async ({ body, userId }) => {
    // The chatId is caller-supplied by design (testing a not-yet-saved id),
    // which makes the bot a message relay — the cap is what bounds that.
    await enforceRateLimit(`testTelegram:user:${userId}`, 5, 3600);
    const { chatId } = body;
    try {
      await telegramService.sendMessage(chatId, 'test my expenses connection');
      return {
        success: true,
        message: 'Test telegram message sent successfully',
      };
    } catch (error) {
      logger.error(
        { err: error, chatId },
        'Failed to send test telegram message',
      );
      return {
        success: false,
        message: `Failed to send test telegram message, ${extractTestTelegramFailureMessage(error)}`,
      };
    }
  },
});
