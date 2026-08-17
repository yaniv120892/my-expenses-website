import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findByUserAndDescription, getTransactionsList } = vi.hoisted(() => ({
  findByUserAndDescription: vi.fn(),
  getTransactionsList: vi.fn(),
}));

vi.mock('@/server/repositories/userCategoryMappingRepository', () => ({
  default: { findByUserAndDescription },
}));

vi.mock('@/server/repositories/transactionRepository', () => ({
  default: { getTransactionsList },
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

beforeEach(() => {
  vi.clearAllMocks();
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
