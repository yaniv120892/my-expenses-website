import type { HouseholdRole, Invite } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import { toHouseholdId } from '@/server/auth/householdId';
import type { InvitableRole } from '@/shared/types/household';

export type HouseholdMemberRow = {
  id: string;
  username: string;
  email: string;
  householdRole: HouseholdRole;
};

export type PendingInviteRow = {
  id: string;
  code: string;
  role: HouseholdRole;
  expiresAt: Date;
  createdAt: Date;
};

const MEMBER_SELECT = {
  id: true,
  username: true,
  email: true,
  householdRole: true,
} as const;

class HouseholdRepository {
  public async listIds(): Promise<HouseholdId[]> {
    const households = await prisma.household.findMany({ select: { id: true } });
    return households.map((household) => toHouseholdId(household.id));
  }

  public async findMembers(householdId: HouseholdId): Promise<HouseholdMemberRow[]> {
    return prisma.user.findMany({
      where: { householdId },
      select: MEMBER_SELECT,
      orderBy: [{ householdRole: 'asc' }, { username: 'asc' }],
    });
  }

  public async findMember(
    householdId: HouseholdId,
    memberId: string,
  ): Promise<HouseholdMemberRow | null> {
    return prisma.user.findFirst({ where: { id: memberId, householdId }, select: MEMBER_SELECT });
  }

  public async findOwnerName(householdId: HouseholdId): Promise<string | null> {
    const owner = await prisma.user.findFirst({
      where: { householdId, householdRole: 'OWNER' },
      select: { username: true },
    });
    return owner?.username ?? null;
  }

  /** Other members plus every household-owned row, so a household with any of them is kept. */
  public async countWhatAJoinWouldOrphan({
    householdId,
    memberId,
  }: {
    householdId: HouseholdId;
    memberId: string;
  }): Promise<number> {
    const counts = await Promise.all([
      prisma.user.count({ where: { householdId, id: { not: memberId } } }),
      prisma.transaction.count({ where: { householdId } }),
      prisma.import.count({ where: { householdId } }),
      prisma.importedTransaction.count({ where: { householdId } }),
      prisma.scheduledTransaction.count({ where: { householdId } }),
      prisma.userCategoryMapping.count({ where: { householdId } }),
      prisma.autoApproveRule.count({ where: { householdId } }),
      prisma.detectedSubscription.count({ where: { householdId } }),
    ]);
    return counts.reduce((total, count) => total + count, 0);
  }

  public async createInvite(data: {
    householdId: HouseholdId;
    code: string;
    role: InvitableRole;
    createdById: string;
    expiresAt: Date;
  }): Promise<PendingInviteRow> {
    return prisma.invite.create({
      data,
      select: { id: true, code: true, role: true, expiresAt: true, createdAt: true },
    });
  }

  public async findPendingInvites(
    householdId: HouseholdId,
    now: Date,
  ): Promise<PendingInviteRow[]> {
    return prisma.invite.findMany({
      where: { householdId, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      select: { id: true, code: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Across households: a code is redeemed by someone outside the household that issued it. */
  public async findInviteByCode(code: string): Promise<Invite | null> {
    return prisma.invite.findUnique({ where: { code } });
  }

  /** Reports whether a still-unused invite of this household was revoked. */
  public async revokeInvite({
    householdId,
    inviteId,
    now,
  }: {
    householdId: HouseholdId;
    inviteId: string;
    now: Date;
  }): Promise<boolean> {
    const revoked = await prisma.invite.updateMany({
      where: { id: inviteId, householdId, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    return revoked.count > 0;
  }

  /**
   * Claims the invite, moves the member in with the invite's role, and drops
   * the household they leave. The claim is guarded on the invite still being
   * open, so of two concurrent redemptions one updates no row; dropping the
   * old household fails on its foreign keys if it gained a member or a row
   * since it was checked. Either rolls the whole move back.
   */
  public async joinHousehold({
    invite,
    memberId,
    leavingHouseholdId,
    now,
  }: {
    invite: Invite;
    memberId: string;
    leavingHouseholdId: HouseholdId;
    now: Date;
  }): Promise<'joined' | 'invite-taken'> {
    return prisma.$transaction(async (transaction) => {
      const claimed = await transaction.invite.updateMany({
        where: { id: invite.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now, usedById: memberId },
      });
      if (claimed.count === 0) {
        return 'invite-taken';
      }
      await transaction.user.update({
        where: { id: memberId },
        data: { householdId: invite.householdId, householdRole: invite.role },
      });
      await transaction.household.delete({ where: { id: leavingHouseholdId } });
      return 'joined';
    });
  }

  /**
   * Gives a member a fresh, empty household of their own, as its owner.
   * `endSessions` bumps their token version, signing them out everywhere.
   */
  public async moveToOwnHousehold({
    fromHouseholdId,
    memberId,
    endSessions,
  }: {
    fromHouseholdId: HouseholdId;
    memberId: string;
    endSessions: boolean;
  }): Promise<boolean> {
    return prisma.$transaction(async (transaction) => {
      const household = await transaction.household.create({ data: {} });
      const moved = await transaction.user.updateMany({
        where: { id: memberId, householdId: fromHouseholdId, householdRole: { not: 'OWNER' } },
        data: {
          householdId: household.id,
          householdRole: 'OWNER',
          ...(endSessions ? { tokenVersion: { increment: 1 } } : {}),
        },
      });
      if (moved.count === 0) {
        await transaction.household.delete({ where: { id: household.id } });
        return false;
      }
      return true;
    });
  }

  /** Never touches the owner, whose role is not for changing. */
  public async changeMemberRole({
    householdId,
    memberId,
    role,
  }: {
    householdId: HouseholdId;
    memberId: string;
    role: InvitableRole;
  }): Promise<boolean> {
    const changed = await prisma.user.updateMany({
      where: { id: memberId, householdId, householdRole: { not: 'OWNER' } },
      data: { householdRole: role },
    });
    return changed.count > 0;
  }
}

const householdRepository = new HouseholdRepository();
export default householdRepository;
