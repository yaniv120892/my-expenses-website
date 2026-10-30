import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';

export type HouseholdActivityRow = Prisma.HouseholdActivityGetPayload<{
  include: { actorUser: { select: { username: true } } };
}>;

class HouseholdActivityRepository {
  public async append(rows: Prisma.HouseholdActivityCreateManyInput[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await prisma.householdActivity.createMany({ data: rows });
  }

  /** Newest first; `cursor` is the id of the last row of the previous page. */
  public async findPage({
    householdId,
    cursor,
    limit,
  }: {
    householdId: HouseholdId;
    cursor: string | undefined;
    limit: number;
  }): Promise<HouseholdActivityRow[]> {
    return prisma.householdActivity.findMany({
      where: { householdId },
      include: { actorUser: { select: { username: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }
}

const householdActivityRepository = new HouseholdActivityRepository();
export default householdActivityRepository;
