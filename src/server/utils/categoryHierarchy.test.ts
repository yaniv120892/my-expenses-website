import { describe, expect, it } from 'vitest';
import {
  buildDescendantMap,
  buildParentMap,
  rollUpToNamedTopLevel,
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
  const parentMap = buildParentMap([
    { id: 'food', parentId: null },
    { id: 'groceries', parentId: 'food' },
    { id: 'rent', parentId: null },
  ]);

  it('sums children into their top-level category, largest first', () => {
    expect(
      rollUpToTopLevel(
        [
          { categoryId: 'groceries', amount: 300 },
          { categoryId: 'food', amount: 100 },
          { categoryId: 'rent', amount: 600 },
        ],
        parentMap,
      ),
    ).toEqual([
      { categoryId: 'rent', amount: 600 },
      { categoryId: 'food', amount: 400 },
    ]);
  });

  it('keeps an unknown category as its own root', () => {
    expect(
      rollUpToTopLevel([{ categoryId: 'gone', amount: 5 }], parentMap),
    ).toEqual([{ categoryId: 'gone', amount: 5 }]);
  });
});

describe('rollUpToNamedTopLevel', () => {
  it('names each root, and an id missing from the list as Unknown', () => {
    expect(
      rollUpToNamedTopLevel(
        [
          { categoryId: 'groceries', amount: 300 },
          { categoryId: 'gone', amount: 5 },
        ],
        [
          { id: 'food', name: 'Food', parentId: null },
          { id: 'groceries', name: 'Groceries', parentId: 'food' },
        ],
      ),
    ).toEqual([
      { categoryId: 'food', categoryName: 'Food', amount: 300 },
      { categoryId: 'gone', categoryName: 'Unknown', amount: 5 },
    ]);
  });
});
