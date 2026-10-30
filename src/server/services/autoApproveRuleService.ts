import type { z } from 'zod';
import type { AutoApproveRule } from '@/generated/prisma/client';
import type { MemberActor } from '@/server/auth/householdActor.types';
import { autoApproveRuleRepository } from '@/server/repositories/autoApproveRuleRepository';
import householdActivityService from '@/server/services/householdActivityService';
import type { ActivityEntry } from '@/server/services/householdActivityService';
import type {
  createAutoApproveRuleSchema,
  updateAutoApproveRuleSchema,
} from '@/shared/schemas/imports';

type CreateAutoApproveRuleInput = z.infer<typeof createAutoApproveRuleSchema>;
type UpdateAutoApproveRuleInput = z.infer<typeof updateAutoApproveRuleSchema>;

class AutoApproveRuleService {
  public async createRule(
    actor: MemberActor,
    input: CreateAutoApproveRuleInput,
  ): Promise<AutoApproveRule> {
    return householdActivityService.record({
      actor,
      write: () =>
        autoApproveRuleRepository.create({
          householdId: actor.householdId,
          userId: actor.userId,
          descriptionPattern: input.descriptionPattern,
          categoryId: input.categoryId,
          type: input.type,
        }),
      describe: (rule) => ruleActivity('CREATE', rule),
    });
  }

  public async updateRule(
    actor: MemberActor,
    ruleId: string,
    input: UpdateAutoApproveRuleInput,
  ): Promise<AutoApproveRule> {
    return householdActivityService.record({
      actor,
      write: () => autoApproveRuleRepository.update(actor.householdId, ruleId, input),
      describe: (rule) => ruleActivity('UPDATE', rule),
    });
  }

  public async deleteRule(actor: MemberActor, ruleId: string): Promise<void> {
    await householdActivityService.record({
      actor,
      write: () => autoApproveRuleRepository.delete(actor.householdId, ruleId),
      describe: (rule) => ruleActivity('DELETE', rule),
    });
  }
}

function ruleActivity(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  rule: AutoApproveRule,
): ActivityEntry {
  return {
    action,
    entityType: 'AUTO_APPROVE_RULE',
    entityId: rule.id,
    summary: rule.descriptionPattern,
  };
}

const autoApproveRuleService = new AutoApproveRuleService();
export default autoApproveRuleService;
