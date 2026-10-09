import { createHandler } from '@/server/http/handler';
import { apiTokenService } from '@/server/services/apiTokenService';

export const DELETE = createHandler({
  auth: 'session',
  handler: async ({ userId, params }) => {
    await apiTokenService.revoke(params.tokenId, userId);
    return { success: true };
  },
});
