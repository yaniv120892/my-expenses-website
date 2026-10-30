import { createHandler } from '@/server/http/handler';
import { RATE_LIMITS } from '@/server/http/rateLimit';
import householdService from '@/server/services/householdService';
import { inviteCodeQuerySchema } from '@/shared/schemas/household';

export const GET = createHandler({
  auth: 'session',
  querySchema: inviteCodeQuerySchema,
  rateLimit: ({ userId }) => [
    { key: `householdInvite:user:${userId}`, ...RATE_LIMITS.householdInvite },
  ],
  handler: async ({ actor, query }) => householdService.previewInvite(actor, query.code),
});
