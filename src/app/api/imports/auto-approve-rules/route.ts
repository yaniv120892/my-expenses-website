import { createHandler } from '@/server/http/handler';
import { createAutoApproveRuleSchema } from '@/shared/schemas/imports';
import { autoApproveRuleRepository } from '@/server/repositories/autoApproveRuleRepository';
import autoApproveRuleService from '@/server/services/autoApproveRuleService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ actor }) => autoApproveRuleRepository.findByHousehold(actor.householdId),
});

export const POST = createHandler({
  auth: 'session',
  bodySchema: createAutoApproveRuleSchema,
  handler: async ({ actor, body }) => autoApproveRuleService.createRule(actor, body),
});
