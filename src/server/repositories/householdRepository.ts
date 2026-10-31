import prisma from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import { toHouseholdId } from '@/server/auth/householdId';

class HouseholdRepository {
  public async listIds(): Promise<HouseholdId[]> {
    const households = await prisma.household.findMany({ select: { id: true } });
    return households.map((household) => toHouseholdId(household.id));
  }

  public async listIdsWithVerifiedMember(): Promise<HouseholdId[]> {
    const households = await prisma.household.findMany({
      where: { members: { some: { verified: true } } },
      select: { id: true },
    });
    return households.map((household) => toHouseholdId(household.id));
  }
}

const householdRepository = new HouseholdRepository();
export default householdRepository;
