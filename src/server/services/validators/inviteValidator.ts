import type { Invite } from '@/generated/prisma/client';
import type { HouseholdId, MemberActor } from '@/server/auth/householdActor.types';
import { HttpError } from '@/server/http/errors';
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
    if (!invite || !this.isOpen(invite, now)) {
      throw new HttpError(404, 'This invite link is not valid. It may have expired or been used.');
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
    const orphaned = await householdRepository.countWhatAJoinWouldOrphan({
      householdId: actor.householdId,
      memberId: actor.userId,
    });
    return orphaned === 0 ? 'can-join' : 'household-in-use';
  }

  public assertIsOwner(actor: MemberActor): void {
    if (actor.role !== 'OWNER') {
      throw new HttpError(
        403,
        'Only the owner of this household can manage its members and invites',
      );
    }
  }

  /** The owner manages others; their own membership is not theirs to remove or demote. */
  public assertManagesSomeoneElse({ actor, memberId }: { actor: MemberActor; memberId: string }) {
    if (actor.userId === memberId) {
      throw new HttpError(400, 'The owner cannot change their own membership');
    }
  }

  public assertCanLeave(actor: MemberActor): void {
    if (actor.role === 'OWNER') {
      throw new HttpError(
        409,
        'The owner cannot leave the household; remove the other members first',
      );
    }
  }

  public async assertIsMember({
    householdId,
    memberId,
  }: {
    householdId: HouseholdId;
    memberId: string;
  }): Promise<void> {
    const member = await householdRepository.findMember(householdId, memberId);
    if (!member) {
      throw new HttpError(404, 'No such member in this household');
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
