import type { Invite } from '@/generated/prisma/client';
import type { MemberActor } from '@/server/auth/householdActor.types';
import { HouseholdRefusal } from '@/server/services/householdRefusal';
import householdRepository from '@/server/repositories/householdRepository';
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '@/server/utils/inviteCode';
import type { JoinEligibility } from '@/shared/types/household';

/**
 * Redeeming an invite and managing members each have several independent ways
 * to fail, so the checks live here rather than in the household service.
 */
export class InviteValidator {
  /** One message for every code that cannot be redeemed, so a guesser learns nothing from it. */
  public async assertCanRedeem(rawCode: string, now: Date): Promise<Invite> {
    const code = normalizeInviteCode(rawCode);
    const invite =
      code.length === INVITE_CODE_LENGTH ? await householdRepository.findInviteByCode(code) : null;
    const isRedeemable = invite !== null && this.isOpen(invite, now);
    if (!isRedeemable) {
      throw new HouseholdRefusal({
        status: 404,
        message: 'This invite link is not valid. It may have expired or been used.',
        code: 'INVITE_INVALID',
      });
    }
    return invite;
  }

  public async joinEligibility({
    actor,
    targetHouseholdId,
  }: {
    actor: MemberActor;
    targetHouseholdId: string;
  }): Promise<JoinEligibility> {
    if (actor.householdId === targetHouseholdId) {
      return 'already-member';
    }
    const wouldOrphan = await householdRepository.hasAnythingAJoinWouldOrphan({
      householdId: actor.householdId,
      memberId: actor.userId,
    });
    return wouldOrphan ? 'household-in-use' : 'can-join';
  }

  public assertIsOwner(actor: MemberActor): void {
    if (actor.role !== 'OWNER') {
      throw new HouseholdRefusal({
        status: 403,
        message: 'Only the owner of this household can manage its members and invites',
        code: 'NOT_HOUSEHOLD_OWNER',
      });
    }
  }

  /** The owner manages others; their own membership is not theirs to remove or demote. */
  public assertManagesSomeoneElse({ actor, memberId }: { actor: MemberActor; memberId: string }) {
    if (actor.userId === memberId) {
      throw new HouseholdRefusal({
        status: 400,
        message: 'The owner cannot change their own membership',
        code: 'OWNER_OWN_MEMBERSHIP',
      });
    }
  }

  public assertCanLeave(actor: MemberActor): void {
    if (actor.role === 'OWNER') {
      throw new HouseholdRefusal({
        status: 409,
        message: 'The owner cannot leave their own household',
        code: 'OWNER_CANNOT_LEAVE',
      });
    }
  }

  private isOpen(invite: Invite, now: Date): boolean {
    return (
      invite.usedAt === null &&
      invite.revokedAt === null &&
      invite.expiresAt.getTime() > now.getTime()
    );
  }
}

export const inviteValidator = new InviteValidator();
