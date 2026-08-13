import { createHandler } from '@/server/http/handler';

// The bot is send-only (notifications and summaries). Incoming updates are
// acknowledged so Telegram does not retry them.
export const POST = createHandler({
  auth: 'telegram',
  handler: async () => ({}),
});
