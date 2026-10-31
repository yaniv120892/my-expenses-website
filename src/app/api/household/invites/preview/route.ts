import { createHandler } from '@/server/http/handler';
import { householdInviteRateLimit } from '@/server/http/rateLimit';
import householdService from '@/server/services/householdService';
import { inviteCodeRequestSchema } from '@/shared/schemas/household';

export const GET = createHandler({
  auth: 'session',
  querySchema: inviteCodeRequestSchema,
  rateLimit: ({ userId }) => [householdInviteRateLimit(userId)],
  handler: async ({ actor, query }) => householdService.previewInvite(actor, query.code),
});
