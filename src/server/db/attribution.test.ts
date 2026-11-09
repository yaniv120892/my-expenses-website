import { describe, expect, it } from 'vitest';
import { stampFor, stampWrite } from '@/server/db/attribution';
import { systemActor } from '@/server/auth/householdActor';
import { toHouseholdId } from '@/server/auth/householdId';

const USER = 'user-1';
const HOUSEHOLD = toHouseholdId('household-1');
const MEMBER_STAMP = stampFor({
  kind: 'member',
  userId: USER,
  householdId: HOUSEHOLD,
  role: 'EDITOR',
  apiTokenId: null,
});
const SYSTEM_STAMP = stampFor(
  systemActor({ householdId: HOUSEHOLD, job: 'scheduled-transactions' }),
);

describe('stampWrite', () => {
  it('stamps the creator on every row a create writes', () => {
    expect(
      stampWrite({ operation: 'create', args: { data: { a: 1 } }, stamp: MEMBER_STAMP }),
    ).toEqual({
      data: { a: 1, createdById: USER },
    });
    expect(
      stampWrite({
        operation: 'createMany',
        args: { data: [{ a: 1 }, { a: 2 }] },
        stamp: MEMBER_STAMP,
      }),
    ).toEqual({
      data: [
        { a: 1, createdById: USER },
        { a: 2, createdById: USER },
      ],
    });
  });

  it('stamps the editor on an update, leaving the creator alone', () => {
    expect(
      stampWrite({
        operation: 'updateMany',
        args: { where: { id: 'x' }, data: { a: 1 } },
        stamp: MEMBER_STAMP,
      }),
    ).toEqual({ where: { id: 'x' }, data: { a: 1, updatedById: USER } });
  });

  it('stamps each branch of an upsert as what it does', () => {
    expect(
      stampWrite({
        operation: 'upsert',
        args: { where: {}, create: { a: 1 }, update: { a: 2 } },
        stamp: MEMBER_STAMP,
      }),
    ).toEqual({
      where: {},
      create: { a: 1, createdById: USER },
      update: { a: 2, updatedById: USER },
    });
  });

  it.each(['findMany', 'delete', 'deleteMany', 'count'])('leaves %s untouched', (operation) => {
    const args = { where: { id: 'x' } };
    expect(stampWrite({ operation, args, stamp: MEMBER_STAMP })).toBe(args);
  });

  it('marks what a system job creates and leaves what it updates alone', () => {
    expect(
      stampWrite({ operation: 'create', args: { data: { a: 1 } }, stamp: SYSTEM_STAMP }),
    ).toEqual({ data: { a: 1, createdBySystem: true } });
    expect(
      stampWrite({
        operation: 'update',
        args: { where: { id: 'x' }, data: { a: 1 } },
        stamp: SYSTEM_STAMP,
      }),
    ).toEqual({ where: { id: 'x' }, data: { a: 1 } });
  });
});
