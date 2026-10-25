import { z } from 'zod';
import { createHandler } from '@/server/http/handler';
import telegramLinkService from '@/server/services/telegramLinkService';

// Every update is acknowledged with a 200, or Telegram redelivers it; an update
// that is not a text message (an edit, a channel post) parses to no message.
const telegramUpdateSchema = z.object({
  message: z
    .object({
      chat: z.object({ id: z.union([z.number(), z.string()]) }),
      text: z.string().optional(),
    })
    .optional()
    .catch(undefined),
});

// The bot only sends, apart from `/start <code>`, which links the chat it
// arrives from to the account that issued the code.
export const POST = createHandler({
  auth: 'telegram',
  bodySchema: telegramUpdateSchema,
  handler: async ({ body }) => {
    if (body.message) {
      await telegramLinkService.handleIncomingMessage({
        chatId: String(body.message.chat.id),
        text: body.message.text,
      });
    }
    return {};
  },
});
