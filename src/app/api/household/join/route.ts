import { createHandler } from '@/server/http/handler';
import { RATE_LIMITS } from '@/server/http/rateLimit';
import householdService from '@/server/services/householdService';
import { joinHouseholdSchema } from '@/shared/schemas/household';

export const POST = createHandler({
  auth: 'session',
  writes: 'ownAccount',
  bodySchema: joinHouseholdSchema,
  rateLimit: ({ userId }) => [
    { key: `householdInvite:user:${userId}`, ...RATE_LIMITS.householdInvite },
  ],
  handler: async ({ actor, body }) => {
    await householdService.acceptInvite(actor, body.code);
    return { success: true };
  },
});
