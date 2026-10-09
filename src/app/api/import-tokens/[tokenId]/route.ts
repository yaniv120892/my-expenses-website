import { createHandler } from '@/server/http/handler';
import { importTokenService } from '@/server/auth/importTokens';

export const DELETE = createHandler({
  auth: 'session',
  handler: async ({ userId, params }) => {
    await importTokenService.revoke(params.tokenId, userId);
    return { success: true };
  },
});
