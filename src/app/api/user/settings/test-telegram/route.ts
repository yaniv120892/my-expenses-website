import { createHandler } from '@/server/http/handler';
import { telegramService } from '@/server/services/telegramService';
import userSettingsService from '@/server/services/userSettingsService';
import logger from '@/server/logging/logger';
import { RATE_LIMITS } from '@/server/http/rateLimit';

// Sends only to the chat the user linked, never one the request names, so the
// bot cannot be used to message an arbitrary chat.
export const POST = createHandler({
  auth: 'session',
  rateLimit: ({ userId }) => [
    { key: `testTelegram:user:${userId}`, ...RATE_LIMITS.testTelegram },
  ],
  handler: async ({ userId }) => {
    const chatId = await userSettingsService.getLinkedTelegramChatId(userId);
    if (!chatId) {
      return {
        success: false,
        message: 'No Telegram chat is linked. Link one first.',
      };
    }
    try {
      await telegramService.sendMessage(chatId, 'test my expenses connection');
      return {
        success: true,
        message: 'Test telegram message sent successfully',
      };
    } catch (error) {
      logger.error(
        { err: error, userId, chatId },
        'Failed to send test telegram message',
      );
      return {
        success: false,
        message:
          'Failed to send test telegram message. Check the chat has not blocked the bot, or link it again.',
      };
    }
  },
});
