import { z } from 'zod';
import { createHandler } from '@/server/http/handler';
import { commandHandler } from '@/server/commandHandlers/commandHandler';
import { telegramService } from '@/server/services/telegramService';
import logger from '@/server/logging/logger';

const telegramUpdateSchema = z.object({
  message: z
    .object({
      chat: z.object({ id: z.union([z.number(), z.string()]) }),
      text: z.string().optional(),
    })
    .optional(),
});

export const POST = createHandler({
  auth: 'telegram',
  bodySchema: telegramUpdateSchema,
  handler: async ({ body }) => {
    // Updates without a text message (edits, joins, etc.) are acknowledged
    // silently so Telegram does not retry them.
    if (!body.message) {
      return {};
    }

    const chatId = body.message.chat.id.toString();
    const text = body.message.text?.trim();

    if (!text) {
      await telegramService.sendMessage(
        chatId,
        'Please enter a valid command.',
      );
      return {};
    }

    const [command, ...args] = text.split(' ');
    try {
      await commandHandler.executeCommand(command, chatId, args);
    } catch (err) {
      logger.error({ err, chatId }, 'Telegram webhook command failed');
      await telegramService.sendMessage(chatId, '❌ An error occurred.');
    }
    return {};
  },
});
