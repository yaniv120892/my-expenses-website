import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invite } from '@/generated/prisma/client';

const { repository } = vi.hoisted(() => ({
  repository: {
    findMembers: vi.fn(),
    findOwnerName: vi.fn(),
    findPendingInvites: vi.fn(),
    findInviteByCode: vi.fn(),
    hasAnythingAJoinWouldOrphan: vi.fn(),
    createInvite: vi.fn(),
    revokeInvite: vi.fn(),
    joinHousehold: vi.fn(),
    moveToOwnHousehold: vi.fn(),
    changeMemberRole: vi.fn(),
  },
}));

vi.mock('@/server/repositories/householdRepository', () => ({ default: repository }));

import householdService from '@/server/services/householdService';
import { testMemberActor } from '@/test/memberActor';

const OWNER = testMemberActor({ userId: 'owner' });
const EDITOR = testMemberActor({ userId: 'editor', role: 'EDITOR' });
const NEWCOMER = testMemberActor({ userId: 'newcomer' });

function openInvite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: 'invite-1',
    householdId: OWNER.householdId,
    code: 'ABCD2345',
    role: 'EDITOR',
    createdById: 'owner',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
    usedAt: null,
    usedById: null,
    revokedAt: null,
    ...overrides,
  };
}

function foreignKeyViolation() {
  return Object.assign(new Error('Foreign key constraint violated'), { code: 'P2003' });
}

beforeEach(() => {
  vi.clearAllMocks();
  repository.findMembers.mockResolvedValue([]);
  repository.findOwnerName.mockResolvedValue('owner-name');
  repository.findPendingInvites.mockResolvedValue([]);
});

describe('getHousehold', () => {
  it('shows pending invites to the owner only', async () => {
    await householdService.getHousehold(OWNER);
    expect(repository.findPendingInvites).toHaveBeenCalledWith(OWNER.householdId, expect.any(Date));

    repository.findPendingInvites.mockClear();
    const asEditor = await householdService.getHousehold(EDITOR);
    expect(repository.findPendingInvites).not.toHaveBeenCalled();
    expect(asEditor.invites).toEqual([]);
  });

  it('marks the requesting member as you', async () => {
    repository.findMembers.mockResolvedValue([
      { id: 'owner', username: 'o', email: 'o@x', householdRole: 'OWNER' },
      { id: 'editor', username: 'e', email: 'e@x', householdRole: 'EDITOR' },
    ]);

    const view = await householdService.getHousehold(EDITOR);

    expect(view.members.map((member) => [member.id, member.isYou])).toEqual([
      ['owner', false],
      ['editor', true],
    ]);
  });
});

describe('createInvite', () => {
  it('refuses anyone but the owner', async () => {
    await expect(householdService.createInvite(EDITOR, 'EDITOR')).rejects.toMatchObject({
      status: 403,
    });
    expect(repository.createInvite).not.toHaveBeenCalled();
  });

  it('issues an invite for the owner household with the chosen role', async () => {
    repository.createInvite.mockImplementation(async (data) => ({
      id: 'invite-1',
      code: data.code,
      role: data.role,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
    }));

    const view = await householdService.createInvite(OWNER, 'VIEWER');

    expect(repository.createInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: OWNER.householdId,
        role: 'VIEWER',
        createdById: 'owner',
      }),
    );
    expect(view.role).toBe('VIEWER');
  });
});

describe('acceptInvite', () => {
  it('moves an empty-handed member into the invite household', async () => {
    repository.findInviteByCode.mockResolvedValue(openInvite());
    repository.hasAnythingAJoinWouldOrphan.mockResolvedValue(false);
    repository.joinHousehold.mockResolvedValue('joined');

    await householdService.acceptInvite(NEWCOMER, 'ABCD2345');

    expect(repository.joinHousehold).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'newcomer', leavingHouseholdId: NEWCOMER.householdId }),
    );
  });

  it('does nothing for a member already in the household', async () => {
    repository.findInviteByCode.mockResolvedValue(openInvite());

    await householdService.acceptInvite(OWNER, 'ABCD2345');

    expect(repository.joinHousehold).not.toHaveBeenCalled();
  });

  it('refuses a member whose own household would be orphaned', async () => {
    repository.findInviteByCode.mockResolvedValue(openInvite());
    repository.hasAnythingAJoinWouldOrphan.mockResolvedValue(true);

    await expect(householdService.acceptInvite(NEWCOMER, 'ABCD2345')).rejects.toMatchObject({
      status: 409,
      code: 'HOUSEHOLD_IN_USE',
    });
    expect(repository.joinHousehold).not.toHaveBeenCalled();
  });

  it('reports an invite another member claimed first as a conflict', async () => {
    repository.findInviteByCode.mockResolvedValue(openInvite());
    repository.hasAnythingAJoinWouldOrphan.mockResolvedValue(false);
    repository.joinHousehold.mockResolvedValue('invite-taken');

    await expect(householdService.acceptInvite(NEWCOMER, 'ABCD2345')).rejects.toMatchObject({
      status: 409,
      code: 'INVITE_TAKEN',
    });
  });

  it('reports a household that gained data mid-join as a conflict, not a 500', async () => {
    repository.findInviteByCode.mockResolvedValue(openInvite());
    repository.hasAnythingAJoinWouldOrphan.mockResolvedValue(false);
    repository.joinHousehold.mockRejectedValue(foreignKeyViolation());

    await expect(householdService.acceptInvite(NEWCOMER, 'ABCD2345')).rejects.toMatchObject({
      status: 409,
      code: 'HOUSEHOLD_IN_USE',
    });
  });
});

describe('membership changes', () => {
  it('removes a member and ends their sessions', async () => {
    repository.moveToOwnHousehold.mockResolvedValue({ apiTokensRevoked: 2 });

    await householdService.removeMember(OWNER, 'editor');

    expect(repository.moveToOwnHousehold).toHaveBeenCalledWith({
      fromHouseholdId: OWNER.householdId,
      memberId: 'editor',
      endSessions: true,
    });
  });

  it('answers 404 when there is no such member to remove', async () => {
    repository.moveToOwnHousehold.mockResolvedValue(null);

    await expect(householdService.removeMember(OWNER, 'stranger')).rejects.toMatchObject({
      status: 404,
      code: 'MEMBER_NOT_FOUND',
    });
  });

  it('refuses an editor removing anyone', async () => {
    await expect(householdService.removeMember(EDITOR, 'owner')).rejects.toMatchObject({
      status: 403,
      code: 'NOT_HOUSEHOLD_OWNER',
    });
    expect(repository.moveToOwnHousehold).not.toHaveBeenCalled();
  });

  it('lets a non-owner leave without ending their session', async () => {
    repository.moveToOwnHousehold.mockResolvedValue({ apiTokensRevoked: 0 });

    await householdService.leave(EDITOR);

    expect(repository.moveToOwnHousehold).toHaveBeenCalledWith({
      fromHouseholdId: EDITOR.householdId,
      memberId: 'editor',
      endSessions: false,
    });
  });

  it('answers 404 when the leaving member was already moved out', async () => {
    repository.moveToOwnHousehold.mockResolvedValue(null);

    await expect(householdService.leave(EDITOR)).rejects.toMatchObject({
      status: 404,
      code: 'MEMBER_NOT_FOUND',
    });
  });

  it('refuses the owner leaving', async () => {
    await expect(householdService.leave(OWNER)).rejects.toMatchObject({
      status: 409,
      code: 'OWNER_CANNOT_LEAVE',
      message: 'The owner cannot leave their own household',
    });
    expect(repository.moveToOwnHousehold).not.toHaveBeenCalled();
  });

  it('refuses the owner removing themselves', async () => {
    await expect(householdService.removeMember(OWNER, 'owner')).rejects.toMatchObject({
      status: 400,
      code: 'OWNER_OWN_MEMBERSHIP',
    });
  });

  it('changes the role of a member of the owner household only', async () => {
    repository.changeMemberRole.mockResolvedValue(true);

    await householdService.changeMemberRole(OWNER, 'editor', 'VIEWER');

    expect(repository.changeMemberRole).toHaveBeenCalledWith({
      householdId: OWNER.householdId,
      memberId: 'editor',
      role: 'VIEWER',
    });
  });

  it('refuses a role change for someone outside the household', async () => {
    repository.changeMemberRole.mockResolvedValue(false);

    await expect(
      householdService.changeMemberRole(OWNER, 'stranger', 'VIEWER'),
    ).rejects.toMatchObject({ status: 404, code: 'MEMBER_NOT_FOUND' });
  });
});

describe('revokeInvite', () => {
  it('answers 404 for an invite that is not open in this household', async () => {
    repository.revokeInvite.mockResolvedValue(false);

    await expect(householdService.revokeInvite(OWNER, 'invite-1')).rejects.toMatchObject({
      status: 404,
      code: 'INVITE_NOT_FOUND',
    });
  });
});
