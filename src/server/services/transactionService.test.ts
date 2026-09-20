import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findByUserAndDescription,
  getTransactionsList,
  getTransactionsSummary,
  getAllCategories,
  reportSwallowedError,
} = vi.hoisted(() => ({
  findByUserAndDescription: vi.fn(),
  getTransactionsList: vi.fn(),
  getTransactionsSummary: vi.fn(),
  getAllCategories: vi.fn(),
  reportSwallowedError: vi.fn(),
}));

vi.mock('@/server/repositories/userCategoryMappingRepository', () => ({
  default: { findByUserAndDescription },
}));

vi.mock('@/server/repositories/transactionRepository', () => ({
  default: { getTransactionsList, getTransactionsSummary },
}));

vi.mock('@/server/repositories/categoryRepository', () => ({
  default: { getAllCategories },
}));

vi.mock('@/server/logging/reportSwallowedError', () => ({
  reportSwallowedError,
}));

import transactionService from '@/server/services/transactionService';
import type { Category } from '@/shared/types/category';

const CATEGORIES = [
  { id: 'cat-food', name: 'Food' },
  { id: 'cat-rent', name: 'Rent' },
] as Category[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serviceInternals = transactionService as any;
const suggestCategory = vi.fn();

const getSuggestedCategory = () =>
  serviceInternals.getSuggestedCategory('Pizza', 'user-1', CATEGORIES);

beforeEach(() => {
  vi.clearAllMocks();
  findByUserAndDescription.mockResolvedValue(null);
  suggestCategory.mockResolvedValue('cat-ai');
  serviceInternals.getCategorySuggester = () => ({ suggestCategory });
});

describe('getAllTransactions', () => {
  const page = (ids: string[], nextCursor: string | null) => ({
    items: ids.map((id) => ({ id })),
    nextCursor,
  });

  it('follows the cursor to the end and concatenates the pages', async () => {
    getTransactionsList
      .mockResolvedValueOnce(page(['t1', 't2'], 'cursor-1'))
      .mockResolvedValueOnce(page(['t3'], null));

    const transactions = await transactionService.getAllTransactions({
      userId: 'user-1',
    });

    expect(transactions.map((transaction) => transaction.id)).toEqual([
      't1',
      't2',
      't3',
    ]);
    expect(getTransactionsList.mock.calls[0][0].cursor).toBeUndefined();
    expect(getTransactionsList.mock.calls[1][0].cursor).toBe('cursor-1');
  });

  it('carries the caller filters and the approved default into the walk', async () => {
    getTransactionsList.mockResolvedValueOnce(page([], null));

    await transactionService.getAllTransactions({
      userId: 'user-1',
      transactionType: 'EXPENSE',
      searchTerm: 'taxi',
    });

    expect(getTransactionsList).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        transactionType: 'EXPENSE',
        searchTerm: 'taxi',
        status: 'APPROVED',
      }),
    );
  });
});

describe('category subtree resolution', () => {
  const CATEGORY_TREE = [
    { id: 'cat-food', parentId: null },
    { id: 'cat-groceries', parentId: 'cat-food' },
    { id: 'cat-organic', parentId: 'cat-groceries' },
    { id: 'cat-rent', parentId: null },
  ];
  const listArgs = (call = 0) => getTransactionsList.mock.calls[call][0];

  beforeEach(() => {
    getAllCategories.mockResolvedValue(CATEGORY_TREE);
    getTransactionsList.mockResolvedValue({ items: [], nextCursor: null });
    getTransactionsSummary.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 0,
      count: 0,
    });
  });

  it('expands a parent category to its whole subtree', async () => {
    await transactionService.getTransactionsList({
      userId: 'user-1',
      categoryId: 'cat-food',
      limit: 50,
    });

    expect(listArgs().categoryIds).toEqual([
      'cat-food',
      'cat-groceries',
      'cat-organic',
    ]);
  });

  it('resolves a leaf category to itself', async () => {
    await transactionService.getTransactionsList({
      userId: 'user-1',
      categoryId: 'cat-organic',
      limit: 50,
    });

    expect(listArgs().categoryIds).toEqual(['cat-organic']);
  });

  it('leaves an unfiltered request without category ids', async () => {
    await transactionService.getTransactionsList({
      userId: 'user-1',
      limit: 50,
    });

    expect(listArgs().categoryIds).toBeUndefined();
    expect(getAllCategories).not.toHaveBeenCalled();
  });

  it('expands the summary the same way as the list', async () => {
    await transactionService.getTransactionsSummary({
      userId: 'user-1',
      categoryId: 'cat-groceries',
    });

    expect(getTransactionsSummary.mock.calls[0][0].categoryIds).toEqual([
      'cat-groceries',
      'cat-organic',
    ]);
  });

  it('resolves once for the whole getAllTransactions walk', async () => {
    getTransactionsList
      .mockResolvedValueOnce({ items: [{ id: 't1' }], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [{ id: 't2' }], nextCursor: null });

    await transactionService.getAllTransactions({
      userId: 'user-1',
      categoryId: 'cat-food',
    });

    expect(getAllCategories).toHaveBeenCalledTimes(1);
    expect(listArgs(1).categoryIds).toEqual(listArgs(0).categoryIds);
  });
});

describe('getSuggestedCategory', () => {
  it('returns a user mapping that resolves to a known category', async () => {
    findByUserAndDescription.mockResolvedValue({ categoryId: 'cat-rent' });
    expect(await getSuggestedCategory()).toBe('cat-rent');
    expect(suggestCategory).not.toHaveBeenCalled();
  });

  it('normalizes the description before looking up a mapping', async () => {
    await serviceInternals.getSuggestedCategory(
      '  PiZZa  ',
      'user-1',
      CATEGORIES,
    );
    expect(findByUserAndDescription).toHaveBeenCalledWith('user-1', 'pizza');
  });

  it.each([
    [
      'no mapping exists',
      () => findByUserAndDescription.mockResolvedValue(null),
    ],
    [
      'the mapped category no longer exists',
      () =>
        findByUserAndDescription.mockResolvedValue({ categoryId: 'cat-gone' }),
    ],
    [
      'the mapping lookup fails',
      () => findByUserAndDescription.mockRejectedValue(new Error('db down')),
    ],
  ])('asks the AI service when %s', async (_case, arrange) => {
    arrange();
    expect(await getSuggestedCategory()).toBe('cat-ai');
    expect(suggestCategory).toHaveBeenCalledWith('Pizza', CATEGORIES);
  });

  it('reports a failed mapping lookup instead of only logging it', async () => {
    const err = new Error('db down');
    findByUserAndDescription.mockRejectedValue(err);
    await getSuggestedCategory();
    expect(reportSwallowedError).toHaveBeenCalledWith(
      { err, userId: 'user-1' },
      'Failed to check user category mapping',
    );
  });

  it('returns null when the AI service has no answer', async () => {
    suggestCategory.mockResolvedValue(null);
    expect(await getSuggestedCategory()).toBeNull();
  });
});
