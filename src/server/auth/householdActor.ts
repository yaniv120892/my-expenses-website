import { AuthError } from '@/server/auth/session';
import { HttpError } from '@/server/http/errors';
import userRepository from '@/server/repositories/userRepository';
import type { HouseholdRole } from '@/generated/prisma/enums';
import type {
  HouseholdActor,
  HouseholdId,
  MemberActor,
  SystemActor,
  SystemJob,
} from '@/server/auth/householdActor.types';
import { toHouseholdId } from '@/server/auth/householdId';

const CAN_WRITE_HOUSEHOLD_DATA = {
  OWNER: true,
  EDITOR: true,
  VIEWER: false,
} satisfies Record<HouseholdRole, boolean>;

export function canWriteHouseholdData(role: HouseholdRole): boolean {
  return CAN_WRITE_HOUSEHOLD_DATA[role];
}

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
  const isSessionRevoked =
    sessionTokenVersion !== null && sessionTokenVersion !== membership?.tokenVersion;
  const isOrphanedApiToken = !membership && apiTokenId !== null;
  if (isOrphanedApiToken) {
    throw new AuthError('INVALID_API_TOKEN', 'Invalid API token');
  }
  const isSessionInvalid = !membership || isSessionRevoked;
  if (isSessionInvalid) {
    throw new AuthError('SESSION_EXPIRED', 'Session expired');
  }
  return {
    kind: 'member',
    userId,
    householdId: toHouseholdId(membership.householdId),
    role: membership.householdRole,
    apiTokenId,
  };
}

export function systemActor({
  householdId,
  job,
}: {
  householdId: HouseholdId;
  job: SystemJob;
}): SystemActor {
  return { kind: 'system', householdId, job };
}

/** The member a write is recorded against; a system job writes as nobody. */
export function actingUserId(actor: HouseholdActor): string | null {
  return actor.kind === 'member' ? actor.userId : null;
}
