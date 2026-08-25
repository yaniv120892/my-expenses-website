import { Category } from '@/shared/types/category';
import prisma from '@/server/db/client';
import { setValue, getValue } from '@/server/redis';

const oneDayInSeconds = 24 * 60 * 60;

function getCacheKeyForAllCategories() {
  return 'allCategories';
}

function getCacheKeyForCategoryById(id: string | null) {
  return `category:${id}`;
}

function getCacheKeyForTopLevelCategories() {
  return 'topLevelCategories';
}

/**
 * Entries written before the double-stringify fix were serialized twice, so
 * they read back as JSON strings — including the string "null" for a category
 * that was looked up while missing, which is truthy and used to skip
 * validation. Parse those on the way out; anything unreadable is a miss.
 */
function parseCached<T>(cached: T | string | null): T | null {
  if (typeof cached !== 'string') {
    return cached;
  }
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export class CategoryRepository {
  public async getAllCategories(): Promise<Category[]> {
    const cacheKey = getCacheKeyForAllCategories();
    const cached = parseCached(await getValue<Category[]>(cacheKey));
    if (cached) {
      return cached;
    }

    const categories = await prisma.category.findMany({
      select: { id: true, name: true, parentId: true },
    });
    await setValue(cacheKey, categories, oneDayInSeconds);
    return categories;
  }

  public async getCategoryById(id: string | null): Promise<Category | null> {
    const cacheKey = getCacheKeyForCategoryById(id);
    const cached = parseCached(await getValue<Category>(cacheKey));
    if (cached) {
      return cached;
    }

    if (!id) {
      return null;
    }
    const category = await prisma.category.findUnique({ where: { id } });
    // An unknown id stays uncached: id-keyed negative entries are unbounded
    // junk, and a cached miss would outlive the category being created.
    if (category) {
      await setValue(cacheKey, category, oneDayInSeconds);
    }
    return category;
  }

  public async getTopLevelCategories(): Promise<Category[]> {
    const cacheKey = getCacheKeyForTopLevelCategories();
    const cached = parseCached(await getValue<Category[]>(cacheKey));
    if (cached) {
      return cached;
    }

    const categories = await prisma.category.findMany({
      where: { parentId: null },
      select: { id: true, name: true },
    });

    await setValue(cacheKey, categories, oneDayInSeconds);
    return categories;
  }
}

export default new CategoryRepository();
