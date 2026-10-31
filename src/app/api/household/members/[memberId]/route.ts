import { createHandler } from '@/server/http/handler';
import householdService from '@/server/services/householdService';
import { changeMemberRoleSchema, memberIdParamsSchema } from '@/shared/schemas/household';

export const PATCH = createHandler({
  auth: 'session',
  paramsSchema: memberIdParamsSchema,
  bodySchema: changeMemberRoleSchema,
  status: 204,
  handler: async ({ actor, params, body }) => {
    await householdService.changeMemberRole(actor, params.memberId, body.role);
  },
});

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: memberIdParamsSchema,
  status: 204,
  handler: async ({ actor, params }) => {
    await householdService.removeMember(actor, params.memberId);
  },
});
