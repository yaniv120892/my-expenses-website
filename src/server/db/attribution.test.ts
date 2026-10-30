import { describe, expect, it } from 'vitest';
import { stampWrite } from '@/server/db/attribution';

const USER = 'user-1';

describe('stampWrite', () => {
  it('stamps the creator on every row a create writes', () => {
    expect(stampWrite({ operation: 'create', args: { data: { a: 1 } }, userId: USER })).toEqual({
      data: { a: 1, createdById: USER },
    });
    expect(
      stampWrite({ operation: 'createMany', args: { data: [{ a: 1 }, { a: 2 }] }, userId: USER }),
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
        userId: USER,
      }),
    ).toEqual({ where: { id: 'x' }, data: { a: 1, updatedById: USER } });
  });

  it('stamps each branch of an upsert as what it does', () => {
    expect(
      stampWrite({
        operation: 'upsert',
        args: { where: {}, create: { a: 1 }, update: { a: 2 } },
        userId: USER,
      }),
    ).toEqual({
      where: {},
      create: { a: 1, createdById: USER },
      update: { a: 2, updatedById: USER },
    });
  });

  it.each(['findMany', 'delete', 'deleteMany', 'count'])('leaves %s untouched', (operation) => {
    const args = { where: { id: 'x' } };
    expect(stampWrite({ operation, args, userId: USER })).toBe(args);
  });
});
