import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invite } from '@/generated/prisma/client';

const { prisma, calls } = vi.hoisted(() => {
  const calls: string[] = [];
  const recorded = (name: string, result: unknown) =>
    vi.fn(async () => {
      calls.push(name);
      return result;
    });
  const client = {
    user: { findFirst: vi.fn(), update: recorded('user.update', {}), updateMany: vi.fn() },
    transaction: { findFirst: vi.fn() },
    import: { findFirst: vi.fn(), deleteMany: recorded('import.deleteMany', { count: 1 }) },
    importedTransaction: {
      findFirst: vi.fn(),
      deleteMany: recorded('importedTransaction.deleteMany', { count: 3 }),
    },
    scheduledTransaction: { findFirst: vi.fn() },
    userCategoryMapping: { findFirst: vi.fn() },
    autoApproveRule: { findFirst: vi.fn() },
    detectedSubscription: { findFirst: vi.fn() },
    invite: { updateMany: vi.fn() },
    household: {
      create: vi.fn(async () => ({ id: 'fresh-household' })),
      delete: recorded('household.delete', {}),
    },
    apiToken: { findMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation(async (work: (transaction: unknown) => unknown) =>
    work(client),
  );
  return { prisma: client, calls };
});
vi.mock('@/server/db/client', () => ({ default: prisma }));

import householdRepository from '@/server/repositories/householdRepository';
import { toHouseholdId } from '@/server/auth/householdId';

const LEAVING = toHouseholdId('leaving-household');

function invite(): Invite {
  return {
    id: 'invite-1',
    householdId: 'target-household',
    code: 'ABCD2345',
    role: 'EDITOR',
    createdById: 'owner',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
    usedAt: null,
    usedById: null,
    revokedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
});

describe('hasAnythingAJoinWouldOrphan', () => {
  it('ignores soft-deleted imports and imported rows', async () => {
    const orphanable = await householdRepository.hasAnythingAJoinWouldOrphan({
      householdId: LEAVING,
      memberId: 'member',
    });

    expect(orphanable).toBe(false);
    expect(prisma.import.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: LEAVING, deleted: false } }),
    );
    expect(prisma.importedTransaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: LEAVING, deleted: false } }),
    );
  });
});

describe('joinHousehold', () => {
  it('purges the leaving household soft-deleted rows before dropping it', async () => {
    prisma.invite.updateMany.mockResolvedValue({ count: 1 });

    const outcome = await householdRepository.joinHousehold({
      invite: invite(),
      memberId: 'member',
      leavingHouseholdId: LEAVING,
      now: new Date(),
    });

    expect(outcome).toBe('joined');
    expect(prisma.importedTransaction.deleteMany).toHaveBeenCalledWith({
      where: { householdId: LEAVING, deleted: true },
    });
    expect(prisma.import.deleteMany).toHaveBeenCalledWith({
      where: { householdId: LEAVING, deleted: true },
    });
    expect(calls).toEqual([
      'user.update',
      'importedTransaction.deleteMany',
      'import.deleteMany',
      'household.delete',
    ]);
  });

  it('touches nothing when the invite was already claimed', async () => {
    prisma.invite.updateMany.mockResolvedValue({ count: 0 });

    const outcome = await householdRepository.joinHousehold({
      invite: invite(),
      memberId: 'member',
      leavingHouseholdId: LEAVING,
      now: new Date(),
    });

    expect(outcome).toBe('invite-taken');
    expect(calls).toEqual([]);
  });
});

describe('moveToOwnHousehold', () => {
  it('revokes every API token of the moved member', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    const tokens = [
      { id: 'token-1', name: 'agent' },
      { id: 'token-2', name: 'script' },
    ];
    prisma.apiToken.findMany.mockResolvedValue(tokens);
    prisma.apiToken.deleteMany.mockResolvedValue({ count: 2 });

    const move = await householdRepository.moveToOwnHousehold({
      fromHouseholdId: LEAVING,
      memberId: 'member',
      endSessions: false,
    });

    expect(move).toEqual({ revokedApiTokens: tokens });
    expect(prisma.apiToken.findMany).toHaveBeenCalledWith({
      where: { userId: 'member' },
      select: { id: true, name: true },
    });
    expect(prisma.apiToken.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['token-1', 'token-2'] } },
    });
  });

  it('revokes nothing and drops the fresh household when the member is not there', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    const move = await householdRepository.moveToOwnHousehold({
      fromHouseholdId: LEAVING,
      memberId: 'stranger',
      endSessions: true,
    });

    expect(move).toBeNull();
    expect(prisma.apiToken.deleteMany).not.toHaveBeenCalled();
    expect(prisma.household.delete).toHaveBeenCalledWith({ where: { id: 'fresh-household' } });
  });
});
