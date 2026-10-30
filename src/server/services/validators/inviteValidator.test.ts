import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invite } from '@/generated/prisma/client';

const { repository } = vi.hoisted(() => ({
  repository: {
    findInviteByCode: vi.fn(),
    hasAnythingAJoinWouldOrphan: vi.fn(),
  },
}));

vi.mock('@/server/repositories/householdRepository', () => ({ default: repository }));

import { inviteValidator } from '@/server/services/validators/inviteValidator';
import { testMemberActor } from '@/test/memberActor';

const NOW = new Date('2026-10-30T12:00:00Z');
const OWNER = testMemberActor({ userId: 'owner' });
const NOT_REDEEMABLE = 'This invite link is not valid. It may have expired or been used.';

function invite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: 'invite-1',
    householdId: 'household-target',
    code: 'ABCD2345',
    role: 'EDITOR',
    createdById: 'owner',
    createdAt: new Date('2026-10-29T12:00:00Z'),
    expiresAt: new Date('2026-11-12T12:00:00Z'),
    usedAt: null,
    usedById: null,
    revokedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assertCanRedeem', () => {
  it('returns an open invite, looked up by its normalized code', async () => {
    repository.findInviteByCode.mockResolvedValue(invite());

    await expect(inviteValidator.assertCanRedeem(' abcd-2345 ', NOW)).resolves.toMatchObject({
      id: 'invite-1',
    });
    expect(repository.findInviteByCode).toHaveBeenCalledWith('ABCD2345');
  });

  it.each([
    ['unknown', null],
    ['used', invite({ usedAt: NOW, usedById: 'someone' })],
    ['revoked', invite({ revokedAt: NOW })],
    ['expired', invite({ expiresAt: NOW })],
  ])('refuses a %s code with the one neutral 404', async (_label, found) => {
    repository.findInviteByCode.mockResolvedValue(found);

    await expect(inviteValidator.assertCanRedeem('ABCD2345', NOW)).rejects.toMatchObject({
      status: 404,
      message: NOT_REDEEMABLE,
      code: 'INVITE_INVALID',
    });
  });

  it('never queries for a code of the wrong length', async () => {
    await expect(inviteValidator.assertCanRedeem('ABC', NOW)).rejects.toMatchObject({
      status: 404,
      code: 'INVITE_INVALID',
    });
    expect(repository.findInviteByCode).not.toHaveBeenCalled();
  });
});

describe('joinEligibility', () => {
  it('reports a member of the target household as already in it', async () => {
    await expect(
      inviteValidator.joinEligibility({ actor: OWNER, targetHouseholdId: OWNER.householdId }),
    ).resolves.toBe('already-member');
    expect(repository.hasAnythingAJoinWouldOrphan).not.toHaveBeenCalled();
  });

  it('lets a member whose household holds nothing but them join', async () => {
    repository.hasAnythingAJoinWouldOrphan.mockResolvedValue(false);

    await expect(
      inviteValidator.joinEligibility({ actor: OWNER, targetHouseholdId: 'household-target' }),
    ).resolves.toBe('can-join');
    expect(repository.hasAnythingAJoinWouldOrphan).toHaveBeenCalledWith({
      householdId: OWNER.householdId,
      memberId: 'owner',
    });
  });

  it('refuses a member whose household has data or other members', async () => {
    repository.hasAnythingAJoinWouldOrphan.mockResolvedValue(true);

    await expect(
      inviteValidator.joinEligibility({ actor: OWNER, targetHouseholdId: 'household-target' }),
    ).resolves.toBe('household-in-use');
  });
});

describe('role checks', () => {
  it.each(['EDITOR', 'VIEWER'] as const)('refuses a %s managing the household', (role) => {
    expect(() => inviteValidator.assertIsOwner(testMemberActor({ userId: 'u', role }))).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('lets the owner manage the household', () => {
    expect(() => inviteValidator.assertIsOwner(OWNER)).not.toThrow();
  });

  it('refuses the owner acting on their own membership', () => {
    expect(() =>
      inviteValidator.assertManagesSomeoneElse({ actor: OWNER, memberId: 'owner' }),
    ).toThrow(expect.objectContaining({ status: 400 }));
  });

  it('refuses the owner leaving, and lets anyone else', () => {
    expect(() => inviteValidator.assertCanLeave(OWNER)).toThrow(
      expect.objectContaining({ status: 409 }),
    );
    expect(() =>
      inviteValidator.assertCanLeave(testMemberActor({ userId: 'u', role: 'VIEWER' })),
    ).not.toThrow();
  });
});
