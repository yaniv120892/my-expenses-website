import { beforeEach, describe, expect, it, vi } from 'vitest';

const { repository } = vi.hoisted(() => ({
  repository: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

const activity = vi.hoisted(() => {
  const entries: unknown[] = [];
  return { entries };
});
vi.mock('@/server/services/householdActivityService', async () =>
  (await import('@/test/householdActivity')).householdActivityModule(activity.entries),
);
vi.mock('@/server/repositories/autoApproveRuleRepository', () => ({
  autoApproveRuleRepository: repository,
}));

import autoApproveRuleService from '@/server/services/autoApproveRuleService';
import { testMemberActor } from '@/test/memberActor';

const ACTOR = testMemberActor({ userId: 'user-1' });
const RULE = {
  id: 'rule-1',
  householdId: ACTOR.householdId,
  descriptionPattern: 'netflix',
  categoryId: 'cat-1',
  type: 'EXPENSE',
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  activity.entries.length = 0;
});

describe('autoApproveRuleService', () => {
  it('creates a rule in the actor household and records it under its pattern', async () => {
    repository.create.mockResolvedValue(RULE);

    await expect(
      autoApproveRuleService.createRule(ACTOR, {
        descriptionPattern: 'netflix',
        categoryId: 'cat-1',
        type: 'EXPENSE',
      }),
    ).resolves.toBe(RULE);

    expect(repository.create).toHaveBeenCalledWith({
      householdId: ACTOR.householdId,
      userId: 'user-1',
      descriptionPattern: 'netflix',
      categoryId: 'cat-1',
      type: 'EXPENSE',
    });
    expect(activity.entries).toEqual([
      { action: 'CREATE', entityType: 'AUTO_APPROVE_RULE', entityId: 'rule-1', summary: 'netflix' },
    ]);
  });

  it('records an updated rule', async () => {
    repository.update.mockResolvedValue(RULE);

    await autoApproveRuleService.updateRule(ACTOR, 'rule-1', { isActive: false });

    expect(repository.update).toHaveBeenCalledWith(ACTOR.householdId, 'rule-1', {
      isActive: false,
    });
    expect(activity.entries).toEqual([
      { action: 'UPDATE', entityType: 'AUTO_APPROVE_RULE', entityId: 'rule-1', summary: 'netflix' },
    ]);
  });

  it('records a deleted rule under the pattern it had', async () => {
    repository.delete.mockResolvedValue(RULE);

    await autoApproveRuleService.deleteRule(ACTOR, 'rule-1');

    expect(repository.delete).toHaveBeenCalledWith(ACTOR.householdId, 'rule-1');
    expect(activity.entries).toEqual([
      { action: 'DELETE', entityType: 'AUTO_APPROVE_RULE', entityId: 'rule-1', summary: 'netflix' },
    ]);
  });
});
