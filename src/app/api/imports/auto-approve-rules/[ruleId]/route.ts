import { createHandler } from '@/server/http/handler';
import { ruleIdParamsSchema } from '@/shared/schemas/common';
import { updateAutoApproveRuleSchema } from '@/shared/schemas/imports';
import autoApproveRuleService from '@/server/services/autoApproveRuleService';

export const PUT = createHandler({
  auth: 'session',
  paramsSchema: ruleIdParamsSchema,
  bodySchema: updateAutoApproveRuleSchema,
  handler: async ({ actor, body, params }) =>
    autoApproveRuleService.updateRule(actor, params.ruleId, body),
});

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: ruleIdParamsSchema,
  handler: async ({ actor, params }) => {
    await autoApproveRuleService.deleteRule(actor, params.ruleId);
    return { success: true };
  },
});
