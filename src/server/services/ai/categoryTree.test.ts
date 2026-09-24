import { describe, it, expect } from 'vitest';
import {
  childCategories,
  topLevelCategories,
} from '@/server/services/ai/categoryTree';

const categories = [
  { id: 'food', name: 'Food & Drinks', parentId: null },
  { id: 'bar', name: 'Bar', parentId: 'food' },
  { id: 'taxi', name: 'Taxi', parentId: 'transportation' },
  { id: 'taxes', name: 'Taxes' },
];

describe('topLevelCategories', () => {
  it('treats a category whose parent was not offered as top level', () => {
    expect(topLevelCategories(categories).map(({ id }) => id)).toEqual([
      'food',
      'taxi',
      'taxes',
    ]);
  });
});

describe('childCategories', () => {
  it('lists the direct children of a parent', () => {
    expect(childCategories(categories, 'food').map(({ id }) => id)).toEqual([
      'bar',
    ]);
  });
});
