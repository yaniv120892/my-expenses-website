import type { HouseholdRole, Invite } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import { toHouseholdId } from '@/server/auth/householdId';
import type { IS_HOUSEHOLD_OWNED } from '@/server/db/householdScope';
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

const INVITE_SELECT = {
  id: true,
  code: true,
  role: true,
  expiresAt: true,
  createdAt: true,
} as const;

type HouseholdOwnedModel = {
  [Model in keyof typeof IS_HOUSEHOLD_OWNED]: (typeof IS_HOUSEHOLD_OWNED)[Model] extends true
    ? Model
    : never;
}[keyof typeof IS_HOUSEHOLD_OWNED];

const ANY_ROW = { select: { id: true } } as const;

// Keyed by every household-owned model, so a new one fails to compile until the
// join check covers it.
const FIND_ANY_OWNED_ROW: Record<
  HouseholdOwnedModel,
  (householdId: HouseholdId) => Promise<unknown>
> = {
  Transaction: (householdId) =>
    prisma.transaction.findFirst({ where: { householdId }, ...ANY_ROW }),
  Import: (householdId) => prisma.import.findFirst({ where: { householdId }, ...ANY_ROW }),
  ImportedTransaction: (householdId) =>
    prisma.importedTransaction.findFirst({ where: { householdId }, ...ANY_ROW }),
  ScheduledTransaction: (householdId) =>
    prisma.scheduledTransaction.findFirst({ where: { householdId }, ...ANY_ROW }),
  UserCategoryMapping: (householdId) =>
    prisma.userCategoryMapping.findFirst({ where: { householdId }, ...ANY_ROW }),
  AutoApproveRule: (householdId) =>
    prisma.autoApproveRule.findFirst({ where: { householdId }, ...ANY_ROW }),
  DetectedSubscription: (householdId) =>
    prisma.detectedSubscription.findFirst({ where: { householdId }, ...ANY_ROW }),
};

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

  public async findMembers(householdId: HouseholdId): Promise<HouseholdMemberRow[]> {
    return prisma.user.findMany({
      where: { householdId },
      select: MEMBER_SELECT,
      orderBy: [{ householdRole: 'asc' }, { username: 'asc' }],
    });
  }

  public async findOwnerName(householdId: HouseholdId): Promise<string | null> {
    const owner = await prisma.user.findFirst({
      where: { householdId, householdRole: 'OWNER' },
      select: { username: true },
    });
    return owner?.username ?? null;
  }

  /** Another member or any household-owned row, either of which keeps the household. */
  public async hasAnythingAJoinWouldOrphan({
    householdId,
    memberId,
  }: {
    householdId: HouseholdId;
    memberId: string;
  }): Promise<boolean> {
    const otherMember = await prisma.user.findFirst({
      where: { householdId, id: { not: memberId } },
      select: { id: true },
    });
    if (otherMember) {
      return true;
    }
    for (const findAnyRow of Object.values(FIND_ANY_OWNED_ROW)) {
      if (await findAnyRow(householdId)) {
        return true;
      }
    }
    return false;
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
      select: INVITE_SELECT,
    });
  }

  public async findPendingInvites(
    householdId: HouseholdId,
    now: Date,
  ): Promise<PendingInviteRow[]> {
    return prisma.invite.findMany({
      where: { householdId, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      select: INVITE_SELECT,
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
