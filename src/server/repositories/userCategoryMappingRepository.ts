import prisma from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';

class UserCategoryMappingRepository {
  public async findByDescription(
    householdId: HouseholdId,
    descriptionPattern: string,
  ): Promise<{ categoryId: string } | null> {
    return prisma.userCategoryMapping.findUnique({
      where: {
        householdId_descriptionPattern: { householdId, descriptionPattern },
      },
      select: { categoryId: true },
    });
  }

  public async upsert({
    householdId,
    userId,
    descriptionPattern,
    categoryId,
  }: {
    householdId: HouseholdId;
    userId: string | null;
    descriptionPattern: string;
    categoryId: string;
  }): Promise<void> {
    await prisma.userCategoryMapping.upsert({
      where: {
        householdId_descriptionPattern: { householdId, descriptionPattern },
      },
      update: {
        categoryId,
        hitCount: { increment: 1 },
      },
      create: {
        householdId,
        userId,
        descriptionPattern,
        categoryId,
      },
    });
  }
}

const userCategoryMappingRepository = new UserCategoryMappingRepository();
export default userCategoryMappingRepository;
