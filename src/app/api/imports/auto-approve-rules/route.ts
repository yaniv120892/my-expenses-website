import { createHandler } from '@/server/http/handler';
import { createAutoApproveRuleSchema } from '@/shared/schemas/imports';
import { autoApproveRuleRepository } from '@/server/repositories/autoApproveRuleRepository';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ userId }) => autoApproveRuleRepository.findByUserId(userId),
});

export const POST = createHandler({
  auth: 'session',
  bodySchema: createAutoApproveRuleSchema,
  handler: async ({ userId, body }) =>
    autoApproveRuleRepository.create({
      userId,
      descriptionPattern: body.descriptionPattern,
      categoryId: body.categoryId,
      type: body.type,
    }),
});
