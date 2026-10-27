import { createHandler } from '@/server/http/handler';
import { RATE_LIMITS } from '@/server/http/rateLimit';
import telegramLinkService from '@/server/services/telegramLinkService';

export const POST = createHandler({
  auth: 'session',
  rateLimit: ({ userId }) => [{ key: `testTelegram:user:${userId}`, ...RATE_LIMITS.testTelegram }],
  handler: async ({ userId }) => telegramLinkService.sendTestMessage(userId),
});
