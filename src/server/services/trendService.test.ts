import { beforeEach, describe, expect, it, vi } from 'vitest';

const { txRepo, categoryRepo, buildCategoryParentMap } = vi.hoisted(() => ({
  txRepo: { getTransactions: vi.fn() },
  categoryRepo: { getTopLevelCategories: vi.fn() },
  buildCategoryParentMap: vi.fn(),
}));

vi.mock('@/server/repositories/transactionRepository', () => ({
  default: txRepo,
}));
vi.mock('@/server/repositories/categoryRepository', () => ({
  default: categoryRepo,
}));
vi.mock('@/server/utils/categoryHierarchy', () => ({
  buildCategoryParentMap,
}));

import trendService from '@/server/services/trendService';

const tx = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  value: 100,
  date: new Date('2026-03-10T00:00:00Z'),
  category: { id: 'child-food' },
  ...over,
});

const request = {
  period: 'monthly' as const,
  startDate: new Date('2026-03-01T00:00:00Z'),
  endDate: new Date('2026-03-31T00:00:00Z'),
};

const run = () => trendService.getCategorySpendingTrends(request, 'user-1');

// Current-period fetch is call 1; the previous-period fetch is call 2.
const periods = (current: unknown[], previous: unknown[] = []) => {
  txRepo.getTransactions
    .mockResolvedValueOnce(current)
    .mockResolvedValueOnce(previous);
};

beforeEach(() => {
  vi.clearAllMocks();
  txRepo.getTransactions.mockResolvedValue([]);
  categoryRepo.getTopLevelCategories.mockResolvedValue([
    { id: 'top-food', name: 'Food' },
    { id: 'top-rent', name: 'Rent' },
  ]);
  buildCategoryParentMap.mockResolvedValue(
    new Map([
      ['child-food', 'top-food'],
      ['child-rent', 'top-rent'],
    ]),
  );
});

describe('getCategorySpendingTrends', () => {
  it('only returns categories something rolled up into', async () => {
    periods([tx()]);
    const result = await run();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      categoryId: 'top-food',
      categoryName: 'Food',
      totalAmount: 100,
    });
  });

  it('rolls child categories up into their top-level ancestor', async () => {
    periods([
      tx({ id: 't1', value: 40, category: { id: 'child-food' } }),
      tx({ id: 't2', value: 60, category: { id: 'child-food' } }),
      tx({ id: 't3', value: 25, category: { id: 'child-rent' } }),
    ]);
    const result = await run();
    expect(result.map((r) => [r.categoryId, r.totalAmount])).toEqual([
      ['top-food', 100],
      ['top-rent', 25],
    ]);
  });

  it('sorts descending by total', async () => {
    periods([
      tx({ id: 't1', value: 10, category: { id: 'child-food' } }),
      tx({ id: 't2', value: 500, category: { id: 'child-rent' } }),
    ]);
    const result = await run();
    expect(result.map((r) => r.categoryId)).toEqual(['top-rent', 'top-food']);
  });

  it('skips transactions with no category', async () => {
    periods([tx({ category: null }), tx({ id: 't2', value: 7 })]);
    const result = await run();
    expect(result).toHaveLength(1);
    expect(result[0].totalAmount).toBe(7);
  });

  it('skips a category with no top-level ancestor', async () => {
    periods([tx({ category: { id: 'orphan' } })]);
    expect(await run()).toEqual([]);
  });

  it('skips an ancestor that is not a known top-level category', async () => {
    buildCategoryParentMap.mockResolvedValue(
      new Map([['child-food', 'top-unknown']]),
    );
    periods([tx()]);
    expect(await run()).toEqual([]);
  });

  it('computes percentage change against the previous period', async () => {
    periods([tx({ value: 150 })], [tx({ id: 'p1', value: 100 })]);
    const result = await run();
    expect(result[0].totalAmount).toBe(150);
    expect(result[0].percentageChange).toBeCloseTo(50, 5);
  });

  it('an empty period yields no trends', async () => {
    periods([]);
    expect(await run()).toEqual([]);
  });

  it('carries points through for the matched category', async () => {
    periods([tx({ value: 100 })]);
    const result = await run();
    expect(result[0].points.length).toBeGreaterThan(0);
    expect(result[0].points[0]).toMatchObject({
      categoryId: 'top-food',
      categoryName: 'Food',
      amount: 100,
    });
  });
});
