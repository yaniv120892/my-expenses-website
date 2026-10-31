import { createHandler } from '@/server/http/handler';
import { householdInviteRateLimit } from '@/server/http/rateLimit';
import householdService from '@/server/services/householdService';
import { inviteCodeRequestSchema } from '@/shared/schemas/household';

export const POST = createHandler({
  auth: 'session',
  writes: 'ownAccount',
  bodySchema: inviteCodeRequestSchema,
  rateLimit: ({ userId }) => [householdInviteRateLimit(userId)],
  handler: async ({ actor, body }) => {
    await householdService.acceptInvite(actor, body.code);
    return { success: true };
  },
});
