import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findByUserAndDescription,
  getTransactionsList,
  getTransactionsSummary,
  getAllCategories,
} = vi.hoisted(() => ({
  findByUserAndDescription: vi.fn(),
  getTransactionsList: vi.fn(),
  getTransactionsSummary: vi.fn(),
  getAllCategories: vi.fn(),
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

import transactionService from '@/server/services/transactionService';
import type { Category } from '@/shared/types/category';

const CATEGORIES = [
  { id: 'cat-food', name: 'Food' },
  { id: 'cat-rent', name: 'Rent' },
] as Category[];

// The categorization chain and the AI client are private to the service; both
// are stubbed so these cases exercise the fallback order rather than the
// categorizer's HTTP call or the provider factory.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = transactionService as any;
const suggestCategory = vi.fn();
const categorizeExpense = vi.fn();

const getSuggestedCategory = () =>
  service.getSuggestedCategory('Pizza', 'user-1', CATEGORIES);

// Food > Groceries > Organic, plus an unrelated top-level category.
const CATEGORY_TREE = [
  { id: 'cat-food', parentId: null },
  { id: 'cat-groceries', parentId: 'cat-food' },
  { id: 'cat-organic', parentId: 'cat-groceries' },
  { id: 'cat-rent', parentId: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  getAllCategories.mockResolvedValue(CATEGORY_TREE);
  findByUserAndDescription.mockResolvedValue(null);
  suggestCategory.mockResolvedValue('cat-ai');
  categorizeExpense.mockResolvedValue(null);
  service.getAiService = () => ({ suggestCategory });
  service.categorizeExpense = categorizeExpense;
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
  const listArgs = () => getTransactionsList.mock.calls[0][0];

  beforeEach(() => {
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
    expect(getTransactionsList.mock.calls[1][0].categoryIds).toEqual([
      'cat-food',
      'cat-groceries',
      'cat-organic',
    ]);
  });
});

describe('getSuggestedCategory', () => {
  it('returns a user mapping that resolves to a known category', async () => {
    findByUserAndDescription.mockResolvedValue({ categoryId: 'cat-rent' });
    expect(await getSuggestedCategory()).toBe('cat-rent');
    expect(categorizeExpense).not.toHaveBeenCalled();
  });

  it('normalizes the description before looking up a mapping', async () => {
    await service.getSuggestedCategory('  PiZZa  ', 'user-1', CATEGORIES);
    expect(findByUserAndDescription).toHaveBeenCalledWith('user-1', 'pizza');
  });

  it('falls through to the categorizer when the mapping lookup fails', async () => {
    findByUserAndDescription.mockRejectedValue(new Error('db down'));
    categorizeExpense.mockResolvedValue({ category: 'Food', confidence: 0.9 });
    expect(await getSuggestedCategory()).toBe('cat-food');
  });

  it('falls through when the mapped category no longer exists', async () => {
    findByUserAndDescription.mockResolvedValue({ categoryId: 'cat-gone' });
    categorizeExpense.mockResolvedValue({ category: 'Food', confidence: 0.9 });
    expect(await getSuggestedCategory()).toBe('cat-food');
  });

  it('takes a high-confidence prediction without asking the LLM', async () => {
    categorizeExpense.mockResolvedValue({ category: 'Food', confidence: 0.7 });
    expect(await getSuggestedCategory()).toBe('cat-food');
    expect(suggestCategory).not.toHaveBeenCalled();
  });

  it('passes a medium-confidence prediction to the LLM as a hint', async () => {
    categorizeExpense.mockResolvedValue({ category: 'Food', confidence: 0.55 });
    expect(await getSuggestedCategory()).toBe('cat-ai');
    expect(suggestCategory).toHaveBeenCalledWith('Pizza', CATEGORIES, {
      hint: 'Food',
      confidence: 0.55,
    });
  });

  it('keeps a null answer from the hinted LLM call instead of retrying', async () => {
    categorizeExpense.mockResolvedValue({ category: 'Food', confidence: 0.4 });
    suggestCategory.mockResolvedValue(null);
    expect(await getSuggestedCategory()).toBeNull();
    expect(suggestCategory).toHaveBeenCalledTimes(1);
  });

  it('asks the LLM without a hint below the medium threshold', async () => {
    categorizeExpense.mockResolvedValue({ category: 'Food', confidence: 0.39 });
    expect(await getSuggestedCategory()).toBe('cat-ai');
    expect(suggestCategory).toHaveBeenCalledWith('Pizza', CATEGORIES);
  });

  it('ignores confidence when the predicted name is not a known category', async () => {
    categorizeExpense.mockResolvedValue({ category: 'Yachts', confidence: 1 });
    expect(await getSuggestedCategory()).toBe('cat-ai');
    expect(suggestCategory).toHaveBeenCalledWith('Pizza', CATEGORIES);
  });

  it('falls back to the unhinted LLM call when the categorizer throws', async () => {
    categorizeExpense.mockRejectedValue(new Error('categorizer down'));
    expect(await getSuggestedCategory()).toBe('cat-ai');
    expect(suggestCategory).toHaveBeenCalledWith('Pizza', CATEGORIES);
  });
});
