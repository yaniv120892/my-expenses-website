import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertHouseholdScoped,
  IS_HOUSEHOLD_OWNED,
  UnscopedHouseholdQueryError,
} from '@/server/db/householdScope';
import { filesUnder, isNonTestSource } from '@/test/sourceFiles';

const REPO_ROOT = path.resolve(__dirname, '../../..');

// The one file that may skip the household check, so every query that does sits
// where a reviewer sees it.
const SYSTEM_PRISMA_IMPORTERS = ['src/server/repositories/crossHouseholdRepository.ts'];

const IMPORTS_SYSTEM_PRISMA = /import[^;]*\bsystemPrisma\b[^;]*from '@\/server\/db\/client'/;

const HOUSEHOLD_REFERENCING_BUT_UNGUARDED = ['Invite', 'User'];

function scoped(operation: string, args: Record<string, unknown>) {
  return () => assertHouseholdScoped({ model: 'Transaction', operation, args });
}

describe('assertHouseholdScoped', () => {
  it.each([
    ['findMany', { where: { householdId: 'h-1', status: 'APPROVED' } }],
    ['findUnique', { where: { id: 'tx-1', householdId: 'h-1' } }],
    ['updateMany', { where: { AND: [{ date: { gte: new Date() } }, { householdId: 'h-1' }] } }],
    ['groupBy', { where: { householdId: 'h-1' }, by: ['type'] }],
    ['create', { data: { householdId: 'h-1', description: 'Coffee' } }],
    ['createMany', { data: [{ householdId: 'h-1' }, { householdId: 'h-1' }] }],
  ])('lets %s through when it names a household', (operation, args) => {
    expect(scoped(operation, args)).not.toThrow();
  });

  it('accepts a compound unique key that includes the household', () => {
    expect(() =>
      assertHouseholdScoped({
        model: 'UserCategoryMapping',
        operation: 'upsert',
        args: {
          where: {
            householdId_descriptionPattern: { householdId: 'h-1', descriptionPattern: 'x' },
          },
          create: { householdId: 'h-1' },
        },
      }),
    ).not.toThrow();
  });

  it.each([
    ['findMany', { where: { userId: 'user-1' } }],
    ['findMany', {}],
    ['findUnique', { where: { id: 'tx-1' } }],
    ['update', { where: { id: 'tx-1' }, data: { description: 'x' } }],
    ['deleteMany', { where: { householdId: undefined } }],
    ['count', { where: { householdId: { in: ['h-1', 'h-2'] } } }],
    ['updateMany', { where: { OR: [{ householdId: 'h-1' }, { id: 'tx-1' }] } }],
    ['create', { data: { description: 'Coffee', userId: 'user-1' } }],
    ['createMany', { data: [{ householdId: 'h-1' }, { description: 'no household' }] }],
  ])('refuses %s that does not pin one household: %j', (operation, args) => {
    expect(scoped(operation, args)).toThrow(UnscopedHouseholdQueryError);
  });

  it('refuses an upsert whose create carries no household', () => {
    expect(() =>
      assertHouseholdScoped({
        model: 'DetectedSubscription',
        operation: 'upsert',
        args: { where: { id: 'sub-1', householdId: 'h-1' }, create: { merchantName: 'x' } },
      }),
    ).toThrow('a row it creates carries no householdId');
  });

  it('leaves models outside any household alone', () => {
    expect(() =>
      assertHouseholdScoped({ model: 'Category', operation: 'findMany', args: {} }),
    ).not.toThrow();
  });
});

describe('the household-owned model list', () => {
  it('matches the schema: every model with a householdId column is guarded or named here', () => {
    const schema = readFileSync(path.join(REPO_ROOT, 'prisma/schema.prisma'), 'utf8');
    const modelsWithHouseholdId = Array.from(
      schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm),
      ([, name, body]) => ({ name, hasHouseholdId: /^\s+householdId\s/m.test(body ?? '') }),
    )
      .filter((model) => model.hasHouseholdId)
      .map((model) => model.name);

    const guarded = Object.entries(IS_HOUSEHOLD_OWNED)
      .filter(([, isOwned]) => isOwned)
      .map(([name]) => name);

    expect(modelsWithHouseholdId.sort()).toEqual(
      [...guarded, ...HOUSEHOLD_REFERENCING_BUT_UNGUARDED].sort(),
    );
  });
});

describe('systemPrisma', () => {
  it('is imported only by the files allowed to work across households', () => {
    const importers = filesUnder(path.join(REPO_ROOT, 'src'), isNonTestSource)
      .filter((file) => IMPORTS_SYSTEM_PRISMA.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(REPO_ROOT, file));

    expect(importers.sort()).toEqual([...SYSTEM_PRISMA_IMPORTERS].sort());
  });
});
