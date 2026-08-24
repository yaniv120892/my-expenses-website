import prisma from '@/server/db/client';

class UserCategoryMappingRepository {
  public async findByUserAndDescription(
    userId: string,
    descriptionPattern: string,
  ): Promise<{ categoryId: string } | null> {
    return prisma.userCategoryMapping.findUnique({
      where: {
        userId_descriptionPattern: { userId, descriptionPattern },
      },
      select: { categoryId: true },
    });
  }

  public async upsert(
    userId: string,
    descriptionPattern: string,
    categoryId: string,
  ): Promise<void> {
    await prisma.userCategoryMapping.upsert({
      where: {
        userId_descriptionPattern: { userId, descriptionPattern },
      },
      update: {
        categoryId,
        hitCount: { increment: 1 },
      },
      create: {
        userId,
        descriptionPattern,
        categoryId,
      },
    });
  }
}

export default new UserCategoryMappingRepository();
