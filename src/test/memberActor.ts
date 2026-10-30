import type { HouseholdRole } from '@/generated/prisma/enums';
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
  return {
    kind: 'member',
    userId,
    householdId: toHouseholdId(`household-of-${userId}`),
    role,
    apiTokenId,
  };
}

/** Stands in for resolveMemberActor, which reads the user's row. */
export async function resolveTestMemberActor(identity: {
  userId: string;
  apiTokenId: string | null;
}): Promise<MemberActor> {
  return testMemberActor(identity);
}
