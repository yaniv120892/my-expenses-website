import { createHandler } from '@/server/http/handler';
import { updateAutoApproveRuleSchema } from '@/shared/schemas/imports';
import { autoApproveRuleRepository } from '@/server/repositories/autoApproveRuleRepository';

export const PUT = createHandler({
  auth: 'session',
  bodySchema: updateAutoApproveRuleSchema,
  handler: async ({ userId, body, params }) =>
    autoApproveRuleRepository.update(params.ruleId, userId, body),
});

export const DELETE = createHandler({
  auth: 'session',
  handler: async ({ userId, params }) => {
    await autoApproveRuleRepository.delete(params.ruleId, userId);
    return { success: true };
  },
});
