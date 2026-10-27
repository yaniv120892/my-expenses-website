import { createHandler } from '@/server/http/handler';
import { RATE_LIMITS } from '@/server/http/rateLimit';
import telegramLinkService from '@/server/services/telegramLinkService';

export const POST = createHandler({
  auth: 'session',
  rateLimit: ({ userId }) => [{ key: `telegramLink:user:${userId}`, ...RATE_LIMITS.telegramLink }],
  handler: async ({ userId }) => telegramLinkService.issueLinkCode(userId),
});

export const DELETE = createHandler({
  auth: 'session',
  status: 204,
  handler: async ({ userId }) => {
    await telegramLinkService.unlink(userId);
  },
});
