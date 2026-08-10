import { AutoApproveRule, TransactionType } from '@prisma/client';
import prisma from '@/server/db/client';

export class AutoApproveRuleRepository {
  async create(data: {
    userId: string;
    descriptionPattern: string;
    categoryId: string;
    type: TransactionType;
  }): Promise<AutoApproveRule> {
    return prisma.autoApproveRule.create({ data });
  }

  async findByUserId(userId: string): Promise<AutoApproveRule[]> {
    return prisma.autoApproveRule.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<AutoApproveRule | null> {
    return prisma.autoApproveRule.findUnique({
      where: { id },
      include: { category: true },
    });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{
      descriptionPattern: string;
      categoryId: string;
      type: TransactionType;
      isActive: boolean;
    }>,
  ): Promise<AutoApproveRule> {
    return prisma.autoApproveRule.update({
      where: { id, userId },
      data,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.autoApproveRule.delete({
      where: { id, userId },
    });
  }

  async findActiveByUserId(userId: string): Promise<AutoApproveRule[]> {
    return prisma.autoApproveRule.findMany({
      where: { userId, isActive: true },
    });
  }
}

export const autoApproveRuleRepository = new AutoApproveRuleRepository();
