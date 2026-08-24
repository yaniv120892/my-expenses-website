import { createHandler } from '@/server/http/handler';
import { ruleIdParamsSchema } from '@/shared/schemas/params';
import { updateAutoApproveRuleSchema } from '@/shared/schemas/imports';
import { autoApproveRuleRepository } from '@/server/repositories/autoApproveRuleRepository';

export const PUT = createHandler({
  auth: 'session',
  paramsSchema: ruleIdParamsSchema,
  bodySchema: updateAutoApproveRuleSchema,
  handler: async ({ userId, body, params }) =>
    autoApproveRuleRepository.update(params.ruleId, userId, body),
});

export const DELETE = createHandler({
  auth: 'session',
  paramsSchema: ruleIdParamsSchema,
  handler: async ({ userId, params }) => {
    await autoApproveRuleRepository.delete(params.ruleId, userId);
    return { success: true };
  },
});
