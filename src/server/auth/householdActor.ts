import { AuthError } from '@/server/auth/session';
import { HttpError } from '@/server/http/errors';
import userRepository from '@/server/repositories/userRepository';
import type { HouseholdRole } from '@/generated/prisma/enums';
import type { MemberActor } from '@/server/auth/householdActor.types';
import { toHouseholdId } from '@/server/auth/householdId';

const CAN_WRITE_HOUSEHOLD_DATA = {
  OWNER: true,
  EDITOR: true,
  VIEWER: false,
} satisfies Record<HouseholdRole, boolean>;

export function canWriteHouseholdData(role: HouseholdRole): boolean {
  return CAN_WRITE_HOUSEHOLD_DATA[role];
}

/** The one write guard: every channel that writes household data calls it. */
export function assertCanWrite(actor: MemberActor): void {
  if (!canWriteHouseholdData(actor.role)) {
    throw new HttpError(
      403,
      `A ${actor.role.toLowerCase()} of this household can read its data but not change it`,
    );
  }
}

/**
 * `sessionTokenVersion` is the version the session JWT was signed with; an API
 * token has none and follows its user to whatever household they are in now.
 */
export async function resolveMemberActor({
  userId,
  apiTokenId,
  sessionTokenVersion,
}: {
  userId: string;
  apiTokenId: string | null;
  sessionTokenVersion: number | null;
}): Promise<MemberActor> {
  const membership = await userRepository.findMembership(userId);
  if (!membership) {
    throw new AuthError('SESSION_EXPIRED', 'Session expired');
  }
  const isSessionRevoked =
    sessionTokenVersion !== null && sessionTokenVersion !== membership.tokenVersion;
  if (isSessionRevoked) {
    throw new AuthError('SESSION_EXPIRED', 'Session expired');
  }
  return {
    userId,
    householdId: toHouseholdId(membership.householdId),
    role: membership.householdRole,
    apiTokenId,
  };
}
