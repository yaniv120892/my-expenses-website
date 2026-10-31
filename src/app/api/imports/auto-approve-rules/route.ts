import { createHandler } from '@/server/http/handler';
import { createAutoApproveRuleSchema } from '@/shared/schemas/imports';
import { autoApproveRuleRepository } from '@/server/repositories/autoApproveRuleRepository';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ actor }) => autoApproveRuleRepository.findByHousehold(actor.householdId),
});

export const POST = createHandler({
  auth: 'session',
  bodySchema: createAutoApproveRuleSchema,
  handler: async ({ userId, actor, body }) =>
    autoApproveRuleRepository.create({
      householdId: actor.householdId,
      userId,
      descriptionPattern: body.descriptionPattern,
      categoryId: body.categoryId,
      type: body.type,
    }),
});
