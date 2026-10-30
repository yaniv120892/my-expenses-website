import type { HouseholdRole, Invite } from '@/generated/prisma/client';
import type { MemberActor } from '@/server/auth/householdActor.types';
import { toHouseholdId } from '@/server/auth/householdId';
import { getPrismaErrorCode, PRISMA_ERROR_CODES } from '@/server/db/prismaErrors';
import { HouseholdRefusal } from '@/server/services/householdRefusal';
import { logger } from '@/server/observability';
import householdRepository from '@/server/repositories/householdRepository';
import householdActivityService from '@/server/services/householdActivityService';
import type { ActivityEntry } from '@/server/services/householdActivityService.types';
import type { MemberMove, PendingInviteRow } from '@/server/repositories/householdRepository.types';
import { inviteValidator } from '@/server/services/validators/inviteValidator';
import { generateInviteCode, inviteExpiryFrom } from '@/server/utils/inviteCode';
import type {
  HouseholdInviteView,
  HouseholdView,
  InvitableRole,
  InvitePreview,
} from '@/shared/types/household';

const HOUSEHOLD_IN_USE_MESSAGE =
  'You already have data or other members in your own household, so you cannot join another one';
const MEMBER_NOT_FOUND_MESSAGE = 'No such member in this household';

class HouseholdService {
  public async getHousehold(actor: MemberActor): Promise<HouseholdView> {
    const now = new Date();
    const [members, invites] = await Promise.all([
      householdRepository.findMembers(actor.householdId),
      this.pendingInvitesFor({ actor, now }),
    ]);
    return {
      role: actor.role,
      ownerName: members.find((member) => member.householdRole === 'OWNER')?.username ?? '',
      members: members.map((member) => ({
        id: member.id,
        username: member.username,
        email: member.email,
        role: member.householdRole,
        isYou: member.id === actor.userId,
      })),
      invites: invites.map((invite) => this.toInviteView(invite)),
    };
  }

  public async createInvite(actor: MemberActor, role: InvitableRole): Promise<HouseholdInviteView> {
    inviteValidator.assertIsOwner(actor);
    const invite = await householdActivityService.record({
      actor,
      write: () =>
        householdRepository.createInvite({
          householdId: actor.householdId,
          code: generateInviteCode(),
          role,
          createdById: actor.userId,
          expiresAt: inviteExpiryFrom(new Date()),
        }),
      describe: (created) => ({
        action: 'INVITE_CREATED',
        entityType: 'INVITE',
        entityId: created.id,
        summary: null,
        role,
      }),
    });
    logger.info({ householdId: actor.householdId, inviteId: invite.id, role }, 'Invite created');
    return this.toInviteView(invite);
  }

  public async revokeInvite(actor: MemberActor, inviteId: string): Promise<void> {
    inviteValidator.assertIsOwner(actor);
    const revoked = await householdActivityService.record({
      actor,
      write: () =>
        householdRepository.revokeInvite({
          householdId: actor.householdId,
          inviteId,
          now: new Date(),
        }),
      describe: (wasRevoked) =>
        wasRevoked
          ? {
              action: 'INVITE_REVOKED',
              entityType: 'INVITE',
              entityId: inviteId,
              summary: null,
            }
          : null,
    });
    if (!revoked) {
      throw new HouseholdRefusal({
        status: 404,
        message: 'No open invite with that id in this household',
        code: 'INVITE_NOT_FOUND',
      });
    }
    logger.info({ householdId: actor.householdId, inviteId }, 'Invite revoked');
  }

  /** What /join shows before the member confirms; throws for a code that cannot be redeemed. */
  public async previewInvite(actor: MemberActor, rawCode: string): Promise<InvitePreview> {
    const invite = await inviteValidator.assertCanRedeem(rawCode, new Date());
    const [ownerName, eligibility] = await Promise.all([
      householdRepository.findOwnerName(toHouseholdId(invite.householdId)),
      inviteValidator.joinEligibility({ actor, targetHouseholdId: invite.householdId }),
    ]);
    return {
      code: invite.code,
      ownerName: ownerName ?? '',
      role: this.toInvitableRole({ role: invite.role, inviteId: invite.id }),
      eligibility,
    };
  }

  /**
   * Moves the member into the invite's household and drops the one they leave,
   * which is allowed only while it holds nothing but them — no data is ever
   * merged or orphaned by an invite.
   */
  public async acceptInvite(actor: MemberActor, rawCode: string): Promise<void> {
    const now = new Date();
    const invite = await inviteValidator.assertCanRedeem(rawCode, now);
    const eligibility = await inviteValidator.joinEligibility({
      actor,
      targetHouseholdId: invite.householdId,
    });
    switch (eligibility) {
      case 'already-member':
        return;
      case 'household-in-use':
        throw new HouseholdRefusal({
          status: 409,
          message: HOUSEHOLD_IN_USE_MESSAGE,
          code: 'HOUSEHOLD_IN_USE',
        });
      case 'can-join':
        break;
      default:
        throw new Error(`Unhandled join eligibility: ${eligibility satisfies never}`);
    }

    const outcome = await householdActivityService.record({
      actor,
      write: () => this.joinOrConflict({ actor, invite, now }),
      describe: (joined) =>
        joined === 'joined'
          ? {
              action: 'MEMBER_JOINED',
              entityType: 'MEMBER',
              entityId: actor.userId,
              summary: null,
              role: invite.role,
              householdId: toHouseholdId(invite.householdId),
            }
          : null,
    });
    if (outcome === 'invite-taken') {
      throw new HouseholdRefusal({
        status: 409,
        message: 'This invite was just used by someone else',
        code: 'INVITE_TAKEN',
      });
    }
    logger.info(
      { userId: actor.userId, householdId: invite.householdId, inviteId: invite.id },
      'Member joined a household',
    );
  }

  /** A non-owner leaves for a fresh, empty household of their own, keeping this session. */
  public async leave(actor: MemberActor): Promise<void> {
    inviteValidator.assertCanLeave(actor);
    const move = await householdActivityService.record({
      actor,
      write: () =>
        householdRepository.moveToOwnHousehold({
          fromHouseholdId: actor.householdId,
          memberId: actor.userId,
          endSessions: false,
        }),
      describe: (memberMove) =>
        memberMove && [
          { action: 'MEMBER_LEFT', entityType: 'MEMBER', entityId: actor.userId, summary: null },
          ...this.tokenRevocations(memberMove),
        ],
    });
    if (!move) {
      throw new HouseholdRefusal({
        status: 404,
        message: MEMBER_NOT_FOUND_MESSAGE,
        code: 'MEMBER_NOT_FOUND',
      });
    }
    logger.info(
      {
        userId: actor.userId,
        householdId: actor.householdId,
        apiTokensRevoked: move.revokedApiTokens.length,
        sessionsEnded: false,
      },
      'Member left a household',
    );
  }

  /** The removed member gets a fresh household, and every session and API token they hold ends. */
  public async removeMember(actor: MemberActor, memberId: string): Promise<void> {
    inviteValidator.assertIsOwner(actor);
    inviteValidator.assertManagesSomeoneElse({ actor, memberId });
    const removal = await householdActivityService.record({
      actor,
      write: async () => {
        const member = await householdRepository.findMember(actor.householdId, memberId);
        if (!member) {
          return null;
        }
        const memberMove = await householdRepository.moveToOwnHousehold({
          fromHouseholdId: actor.householdId,
          memberId,
          endSessions: true,
        });
        return memberMove ? { member, memberMove } : null;
      },
      describe: (removed) =>
        removed && [
          {
            action: 'MEMBER_REMOVED',
            entityType: 'MEMBER',
            entityId: removed.member.id,
            summary: removed.member.username,
          },
          ...this.tokenRevocations(removed.memberMove),
        ],
    });
    if (!removal) {
      throw new HouseholdRefusal({
        status: 404,
        message: MEMBER_NOT_FOUND_MESSAGE,
        code: 'MEMBER_NOT_FOUND',
      });
    }
    logger.info(
      {
        householdId: actor.householdId,
        memberId,
        apiTokensRevoked: removal.memberMove.revokedApiTokens.length,
        sessionsEnded: true,
      },
      'Member removed from a household',
    );
  }

  public async changeMemberRole(
    actor: MemberActor,
    memberId: string,
    role: InvitableRole,
  ): Promise<void> {
    inviteValidator.assertIsOwner(actor);
    inviteValidator.assertManagesSomeoneElse({ actor, memberId });
    const changed = await householdActivityService.record({
      actor,
      write: async () => {
        const member = await householdRepository.findMember(actor.householdId, memberId);
        const updated = await householdRepository.changeMemberRole({
          householdId: actor.householdId,
          memberId,
          role,
        });
        return updated ? member : null;
      },
      describe: (member) =>
        member && {
          action: 'ROLE_CHANGED',
          entityType: 'MEMBER',
          entityId: member.id,
          summary: member.username,
          role,
        },
    });
    if (!changed) {
      throw new HouseholdRefusal({
        status: 404,
        message: MEMBER_NOT_FOUND_MESSAGE,
        code: 'MEMBER_NOT_FOUND',
      });
    }
    logger.info({ householdId: actor.householdId, memberId, role }, 'Member role changed');
  }

  private tokenRevocations(memberMove: MemberMove): ActivityEntry[] {
    return memberMove.revokedApiTokens.map((token) => ({
      action: 'API_TOKEN_REVOKED',
      entityType: 'API_TOKEN',
      entityId: token.id,
      summary: token.name,
    }));
  }

  private async joinOrConflict({
    actor,
    invite,
    now,
  }: {
    actor: MemberActor;
    invite: Invite;
    now: Date;
  }) {
    try {
      return await householdRepository.joinHousehold({
        invite,
        memberId: actor.userId,
        leavingHouseholdId: actor.householdId,
        now,
      });
    } catch (error) {
      // The household gained a member or a row between the check and the drop.
      if (getPrismaErrorCode(error) === PRISMA_ERROR_CODES.FOREIGN_KEY_CONSTRAINT_VIOLATION) {
        throw new HouseholdRefusal({
          status: 409,
          message: HOUSEHOLD_IN_USE_MESSAGE,
          code: 'HOUSEHOLD_IN_USE',
        });
      }
      throw error;
    }
  }

  private pendingInvitesFor({
    actor,
    now,
  }: {
    actor: MemberActor;
    now: Date;
  }): Promise<PendingInviteRow[]> {
    return actor.role === 'OWNER'
      ? householdRepository.findPendingInvites(actor.householdId, now)
      : Promise.resolve([]);
  }

  private toInviteView(invite: PendingInviteRow): HouseholdInviteView {
    return {
      id: invite.id,
      code: invite.code,
      role: this.toInvitableRole({ role: invite.role, inviteId: invite.id }),
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    };
  }

  /** Every invite is written with an invitable role, so an owner one is corrupt data. */
  private toInvitableRole({
    role,
    inviteId,
  }: {
    role: HouseholdRole;
    inviteId: string;
  }): InvitableRole {
    if (role === 'OWNER') {
      throw new Error(`Invite ${inviteId} carries the owner role, which no invite may grant`);
    }
    return role;
  }
}

const householdService = new HouseholdService();
export default householdService;
