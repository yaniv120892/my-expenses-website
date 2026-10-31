import { createHandler } from '@/server/http/handler';
import { tokenIdParamsSchema } from '@/shared/schemas/common';
import { apiTokenService } from '@/server/services/apiTokenService';

export const DELETE = createHandler({
  auth: 'session',
  writes: 'ownAccount',
  paramsSchema: tokenIdParamsSchema,
  handler: async ({ userId, params }) => {
    await apiTokenService.revoke(params.tokenId, userId);
    return { success: true };
  },
});
