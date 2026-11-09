import type { AutoApproveRule, TransactionType } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';

export class AutoApproveRuleRepository {
  public async create(data: {
    householdId: HouseholdId;
    userId: string;
    descriptionPattern: string;
    categoryId: string;
    type: TransactionType;
  }): Promise<AutoApproveRule> {
    return prisma.autoApproveRule.create({ data });
  }

  public async findByHousehold(householdId: HouseholdId): Promise<AutoApproveRule[]> {
    return prisma.autoApproveRule.findMany({
      where: { householdId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async update(
    householdId: HouseholdId,
    id: string,
    data: Partial<{
      descriptionPattern: string;
      categoryId: string;
      type: TransactionType;
      isActive: boolean;
    }>,
  ): Promise<AutoApproveRule> {
    return prisma.autoApproveRule.update({
      where: { id, householdId },
      data,
    });
  }

  public async delete(householdId: HouseholdId, id: string): Promise<AutoApproveRule> {
    return prisma.autoApproveRule.delete({
      where: { id, householdId },
    });
  }

  public async findActiveByHousehold(householdId: HouseholdId): Promise<AutoApproveRule[]> {
    return prisma.autoApproveRule.findMany({
      where: { householdId, isActive: true },
    });
  }
}

export const autoApproveRuleRepository = new AutoApproveRuleRepository();
