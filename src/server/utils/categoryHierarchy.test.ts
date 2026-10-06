import { describe, expect, it } from 'vitest';
import {
  buildDescendantMap,
  buildParentMap,
  rollUpToTopLevel,
  type CategoryNode,
} from '@/server/utils/categoryHierarchy';

const chain: CategoryNode[] = [
  { id: 'A', parentId: null },
  { id: 'B', parentId: 'A' },
  { id: 'C', parentId: 'B' },
];

describe('buildParentMap', () => {
  it('returns an empty map for no categories', () => {
    expect(buildParentMap([]).size).toBe(0);
  });

  it('maps a top-level category to itself', () => {
    const map = buildParentMap([{ id: 'A', parentId: null }]);
    expect(map.get('A')).toBe('A');
  });

  it('treats undefined parentId as top-level', () => {
    const map = buildParentMap([{ id: 'A' }]);
    expect(map.get('A')).toBe('A');
  });

  it('maps every category in a chain to the top-level root', () => {
    const map = buildParentMap(chain);
    expect(map.get('A')).toBe('A');
    expect(map.get('B')).toBe('A');
    expect(map.get('C')).toBe('A');
  });

  it('keeps separate trees apart', () => {
    const map = buildParentMap([
      ...chain,
      { id: 'X', parentId: null },
      { id: 'Y', parentId: 'X' },
    ]);
    expect(map.get('Y')).toBe('X');
    expect(map.get('C')).toBe('A');
    expect(map.size).toBe(5);
  });

  it('terminates on a parent cycle and maps every category', () => {
    const map = buildParentMap([
      { id: 'A', parentId: 'B' },
      { id: 'B', parentId: 'A' },
      { id: 'C', parentId: 'A' },
    ]);
    expect(map.size).toBe(3);
    expect(map.get('A')).toBe('B');
    expect(map.get('B')).toBe('A');
    expect(map.get('C')).toBe('B');
  });

  it('ignores a parentId pointing outside the given categories', () => {
    const map = buildParentMap([{ id: 'B', parentId: 'ghost' }]);
    expect(map.get('B')).toBe('ghost');
  });
});

describe('buildDescendantMap', () => {
  it('returns an empty map for no categories', () => {
    expect(buildDescendantMap([]).size).toBe(0);
  });

  it('maps a leaf to only itself', () => {
    const map = buildDescendantMap(chain);
    expect(map.get('C')).toEqual(['C']);
  });

  it('includes self plus all transitive descendants', () => {
    const map = buildDescendantMap(chain);
    expect(map.get('A')).toEqual(['A', 'B', 'C']);
    expect(map.get('B')).toEqual(['B', 'C']);
  });

  it('collects multiple children of the same parent', () => {
    const map = buildDescendantMap([
      { id: 'A', parentId: null },
      { id: 'B', parentId: 'A' },
      { id: 'C', parentId: 'A' },
      { id: 'D', parentId: 'B' },
    ]);
    const descendants = map.get('A') ?? [];
    expect(descendants).toHaveLength(4);
    expect(new Set(descendants)).toEqual(new Set(['A', 'B', 'C', 'D']));
  });

  it('terminates on a cycle and still lists each id once', () => {
    const map = buildDescendantMap([
      { id: 'A', parentId: 'B' },
      { id: 'B', parentId: 'A' },
    ]);
    expect(map.get('A')).toEqual(['A', 'B']);
    expect(map.get('B')).toEqual(['B', 'A']);
  });
});

describe('rollUpToTopLevel', () => {
  const categories = [
    { id: 'food', name: 'Food', parentId: null },
    { id: 'groceries', name: 'Groceries', parentId: 'food' },
    { id: 'rent', name: 'Rent', parentId: null },
  ];

  it('sums children into their top-level category, largest first', () => {
    const items = rollUpToTopLevel(
      [
        { categoryId: 'groceries', amount: 300 },
        { categoryId: 'food', amount: 100 },
        { categoryId: 'rent', amount: 600 },
      ],
      categories,
    );
    expect(items).toEqual([
      { categoryId: 'rent', categoryName: 'Rent', amount: 600, percentage: 60 },
      { categoryId: 'food', categoryName: 'Food', amount: 400, percentage: 40 },
    ]);
  });

  it('drops zero totals and returns nothing for no rows', () => {
    expect(
      rollUpToTopLevel([{ categoryId: 'rent', amount: 0 }], categories),
    ).toEqual([]);
    expect(rollUpToTopLevel([], categories)).toEqual([]);
  });

  it('keeps an unknown category as its own slice', () => {
    expect(
      rollUpToTopLevel([{ categoryId: 'gone', amount: 5 }], categories),
    ).toEqual([
      {
        categoryId: 'gone',
        categoryName: 'Unknown',
        amount: 5,
        percentage: 100,
      },
    ]);
  });
});
