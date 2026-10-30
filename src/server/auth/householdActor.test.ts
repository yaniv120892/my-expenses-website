import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HouseholdRole } from '@/generated/prisma/enums';
import { HttpError } from '@/server/http/errors';
import { AuthError } from '@/server/auth/session';
import { testMemberActor } from '@/test/memberActor';

const { findMembership } = vi.hoisted(() => ({ findMembership: vi.fn() }));

vi.mock('@/server/repositories/userRepository', () => ({
  default: { findMembership },
}));

import {
  assertCanWrite,
  canWriteHouseholdData,
  resolveMemberActor,
} from '@/server/auth/householdActor';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const HOUSEHOLD_ID = '22222222-2222-4222-8222-222222222222';

function membership(overrides: { householdRole?: HouseholdRole; tokenVersion?: number } = {}) {
  return { householdId: HOUSEHOLD_ID, householdRole: 'EDITOR', tokenVersion: 3, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the role check', () => {
  it.each([
    ['OWNER', true],
    ['EDITOR', true],
    ['VIEWER', false],
  ] as const)('lets a %s write household data: %s', (role, canWrite) => {
    expect(canWriteHouseholdData(role)).toBe(canWrite);
  });

  it('refuses a viewer with a 403 naming the role', () => {
    const viewer = testMemberActor({ userId: USER_ID, role: 'VIEWER' });

    expect(() => assertCanWrite(viewer)).toThrow(HttpError);
    expect(() => assertCanWrite(viewer)).toThrow(/viewer/);
    try {
      assertCanWrite(viewer);
    } catch (error) {
      expect(error).toMatchObject({ status: 403 });
    }
  });

  it('lets an editor through', () => {
    expect(() =>
      assertCanWrite(testMemberActor({ userId: USER_ID, role: 'EDITOR' })),
    ).not.toThrow();
  });
});

describe('resolveMemberActor', () => {
  it("acts in the user's current household with their current role", async () => {
    findMembership.mockResolvedValue(membership());

    const actor = await resolveMemberActor({
      userId: USER_ID,
      apiTokenId: null,
      sessionTokenVersion: 3,
    });

    expect(actor).toEqual({
      kind: 'member',
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
      role: 'EDITOR',
      apiTokenId: null,
    });
  });

  it('ends a session signed before the token version was bumped', async () => {
    findMembership.mockResolvedValue(membership({ tokenVersion: 4 }));

    await expect(
      resolveMemberActor({ userId: USER_ID, apiTokenId: null, sessionTokenVersion: 3 }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("follows an API token's user into whatever household they are in now", async () => {
    findMembership.mockResolvedValue(membership({ householdRole: 'VIEWER', tokenVersion: 9 }));

    const actor = await resolveMemberActor({
      userId: USER_ID,
      apiTokenId: 'token-1',
      sessionTokenVersion: null,
    });

    expect(actor).toMatchObject({
      householdId: HOUSEHOLD_ID,
      role: 'VIEWER',
      apiTokenId: 'token-1',
    });
  });

  it('refuses a session for a user that no longer exists', async () => {
    findMembership.mockResolvedValue(null);

    await expect(
      resolveMemberActor({ userId: USER_ID, apiTokenId: null, sessionTokenVersion: 0 }),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  });
});
