import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invite } from '@/generated/prisma/client';

const { repository } = vi.hoisted(() => ({
  repository: {
    findMembers: vi.fn(),
    findMember: vi.fn(),
    findOwnerName: vi.fn(),
    findPendingInvites: vi.fn(),
    findInviteByCode: vi.fn(),
    countWhatAJoinWouldOrphan: vi.fn(),
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
    repository.countWhatAJoinWouldOrphan.mockResolvedValue(0);
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
    repository.countWhatAJoinWouldOrphan.mockResolvedValue(1);

    await expect(householdService.acceptInvite(NEWCOMER, 'ABCD2345')).rejects.toMatchObject({
      status: 409,
    });
    expect(repository.joinHousehold).not.toHaveBeenCalled();
  });

  it('reports an invite another member claimed first as a conflict', async () => {
    repository.findInviteByCode.mockResolvedValue(openInvite());
    repository.countWhatAJoinWouldOrphan.mockResolvedValue(0);
    repository.joinHousehold.mockResolvedValue('invite-taken');

    await expect(householdService.acceptInvite(NEWCOMER, 'ABCD2345')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('reports a household that gained data mid-join as a conflict, not a 500', async () => {
    repository.findInviteByCode.mockResolvedValue(openInvite());
    repository.countWhatAJoinWouldOrphan.mockResolvedValue(0);
    repository.joinHousehold.mockRejectedValue(foreignKeyViolation());

    await expect(householdService.acceptInvite(NEWCOMER, 'ABCD2345')).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('membership changes', () => {
  it('removes a member and ends their sessions', async () => {
    repository.moveToOwnHousehold.mockResolvedValue(true);

    await householdService.removeMember(OWNER, 'editor');

    expect(repository.moveToOwnHousehold).toHaveBeenCalledWith({
      fromHouseholdId: OWNER.householdId,
      memberId: 'editor',
      endSessions: true,
    });
  });

  it('answers 404 when there is no such member to remove', async () => {
    repository.moveToOwnHousehold.mockResolvedValue(false);

    await expect(householdService.removeMember(OWNER, 'stranger')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('refuses an editor removing anyone', async () => {
    await expect(householdService.removeMember(EDITOR, 'owner')).rejects.toMatchObject({
      status: 403,
    });
    expect(repository.moveToOwnHousehold).not.toHaveBeenCalled();
  });

  it('lets a non-owner leave without ending their session', async () => {
    repository.moveToOwnHousehold.mockResolvedValue(true);

    await householdService.leave(EDITOR);

    expect(repository.moveToOwnHousehold).toHaveBeenCalledWith({
      fromHouseholdId: EDITOR.householdId,
      memberId: 'editor',
      endSessions: false,
    });
  });

  it('changes the role of a member of the owner household only', async () => {
    repository.findMember.mockResolvedValue({ id: 'editor' });
    repository.changeMemberRole.mockResolvedValue(true);

    await householdService.changeMemberRole(OWNER, 'editor', 'VIEWER');

    expect(repository.findMember).toHaveBeenCalledWith(OWNER.householdId, 'editor');
    expect(repository.changeMemberRole).toHaveBeenCalledWith({
      householdId: OWNER.householdId,
      memberId: 'editor',
      role: 'VIEWER',
    });
  });
});
