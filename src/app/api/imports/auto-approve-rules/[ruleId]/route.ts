import { createHandler } from '@/server/http/handler';
import { ruleIdParamsSchema } from '@/shared/schemas/common';
import { updateAutoApproveRuleSchema } from '@/shared/schemas/imports';
import { autoApproveRuleRepository } from '@/server/repositories/autoApproveRuleRepository';

export const PUT = createHandler({
  auth: 'session',
  paramsSchema: ruleIdParamsSchema,
  bodySchema: updateAutoApproveRuleSchema,
  handler: async ({ actor, body, params }) =>
    autoApproveRuleRepository.update(actor.householdId, params.ruleId, body),
});

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: ruleIdParamsSchema,
  handler: async ({ actor, params }) => {
    await autoApproveRuleRepository.delete(actor.householdId, params.ruleId);
    return { success: true };
  },
});
