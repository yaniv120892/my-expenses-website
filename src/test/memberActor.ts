import { vi } from 'vitest';
import type { HouseholdRole } from '@/generated/prisma/enums';
import type * as HouseholdActorModule from '@/server/auth/householdActor';
import { toHouseholdId } from '@/server/auth/householdId';
import type { MemberActor } from '@/server/auth/householdActor.types';

// Each user is the owner of a household of their own unless a test says
// otherwise, so a route test reads as it did before households.
export function testMemberActor({
  userId,
  apiTokenId = null,
  role = 'OWNER',
}: {
  userId: string;
  apiTokenId?: string | null;
  role?: HouseholdRole;
}): MemberActor {
  return { userId, householdId: toHouseholdId(`household-of-${userId}`), role, apiTokenId };
}

export async function resolveTestMemberActor(identity: {
  userId: string;
  apiTokenId: string | null;
}): Promise<MemberActor> {
  return testMemberActor(identity);
}

export async function householdActorWithTestMembers(): Promise<typeof HouseholdActorModule> {
  return {
    ...(await vi.importActual<typeof HouseholdActorModule>('@/server/auth/householdActor')),
    resolveMemberActor: resolveTestMemberActor,
  };
}
