import { createHandler } from '@/server/http/handler';
import householdService from '@/server/services/householdService';
import { createInviteSchema } from '@/shared/schemas/household';

export const POST = createHandler({
  auth: 'session',
  bodySchema: createInviteSchema,
  status: 201,
  handler: async ({ actor, body }) => householdService.createInvite(actor, body.role),
});
