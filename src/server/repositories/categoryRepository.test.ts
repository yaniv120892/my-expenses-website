import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getValue, setValue } from '@/server/redis';
import prisma from '@/server/db/client';
import categoryRepository from '@/server/repositories/categoryRepository';

vi.mock('@/server/redis', () => ({
  getValue: vi.fn(),
  setValue: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({
  default: {
    category: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const getValueMock = vi.mocked(getValue);
const findUniqueMock = vi.mocked(prisma.category.findUnique);

const groceries = { id: 'cat-1', name: 'Groceries', parentId: null };

describe('categoryRepository.getCategoryById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a cached category', async () => {
    getValueMock.mockResolvedValue(groceries);

    await expect(categoryRepository.getCategoryById('cat-1')).resolves.toEqual(
      groceries,
    );
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('parses a legacy double-stringified entry', async () => {
    getValueMock.mockResolvedValue(JSON.stringify(groceries));

    await expect(categoryRepository.getCategoryById('cat-1')).resolves.toEqual(
      groceries,
    );
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('treats a legacy cached "null" as a miss instead of a category', async () => {
    // Regression: the string "null" is truthy, so a missing category that got
    // cached used to come back as a fake Category and skip validation.
    getValueMock.mockResolvedValue('null');
    findUniqueMock.mockResolvedValue(null);

    await expect(
      categoryRepository.getCategoryById('unknown'),
    ).resolves.toBeNull();
    expect(findUniqueMock).toHaveBeenCalledOnce();
  });

  it('does not cache a missing category', async () => {
    getValueMock.mockResolvedValue(null);
    findUniqueMock.mockResolvedValue(null);

    await expect(
      categoryRepository.getCategoryById('unknown'),
    ).resolves.toBeNull();
    expect(vi.mocked(setValue)).not.toHaveBeenCalled();
  });

  it('caches a found category as a raw object', async () => {
    getValueMock.mockResolvedValue(null);
    findUniqueMock.mockResolvedValue(groceries);

    await categoryRepository.getCategoryById('cat-1');

    expect(vi.mocked(setValue)).toHaveBeenCalledWith(
      'category:cat-1',
      expect.objectContaining({ id: 'cat-1' }),
      expect.any(Number),
    );
  });

  it('falls back to the database when the cache read fails', async () => {
    getValueMock.mockRejectedValue(new Error('redis down'));
    findUniqueMock.mockResolvedValue(groceries);

    await expect(categoryRepository.getCategoryById('cat-1')).resolves.toEqual(
      groceries,
    );
  });
});

describe('categoryRepository list caches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAllCategories parses a legacy double-stringified entry', async () => {
    getValueMock.mockResolvedValue(JSON.stringify([groceries]));

    await expect(categoryRepository.getAllCategories()).resolves.toEqual([
      groceries,
    ]);
    expect(vi.mocked(prisma.category.findMany)).not.toHaveBeenCalled();
  });

  it('getTopLevelCategories caches the raw array', async () => {
    getValueMock.mockResolvedValue(null);
    vi.mocked(prisma.category.findMany).mockResolvedValue([groceries]);

    await categoryRepository.getTopLevelCategories();

    expect(vi.mocked(setValue)).toHaveBeenCalledWith(
      'topLevelCategories',
      [groceries],
      expect.any(Number),
    );
  });
});
