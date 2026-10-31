import { createHandler } from '@/server/http/handler';
import householdService from '@/server/services/householdService';
import { inviteIdParamsSchema } from '@/shared/schemas/household';

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: inviteIdParamsSchema,
  status: 204,
  handler: async ({ actor, params }) => {
    await householdService.revokeInvite(actor, params.inviteId);
  },
});
