import { Category } from '@/shared/types/category';
import prisma from '@/server/db/client';
import { setValue, getValue } from '@/server/redis';
import logger from '@/server/logging/logger';

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

export class CategoryRepository {
  public async getAllCategories(): Promise<Category[]> {
    const cacheKey = getCacheKeyForAllCategories();
    const cached = await this.readCacheSafe<Category[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await prisma.category.findMany({
      select: { id: true, name: true, parentId: true },
    });
    await this.writeCacheSafe(cacheKey, categories);
    return categories;
  }

  public async getCategoryById(id: string | null): Promise<Category | null> {
    if (!id) {
      return null;
    }
    const cacheKey = getCacheKeyForCategoryById(id);
    const cached = await this.readCacheSafe<Category>(cacheKey);
    if (cached) {
      return cached;
    }

    const category = await prisma.category.findUnique({ where: { id } });
    // An unknown id stays uncached: id-keyed negative entries are unbounded
    // junk, and a cached miss would outlive the category being created.
    if (category) {
      await this.writeCacheSafe(cacheKey, category);
    }
    return category;
  }

  public async getTopLevelCategories(): Promise<Category[]> {
    const cacheKey = getCacheKeyForTopLevelCategories();
    const cached = await this.readCacheSafe<Category[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await prisma.category.findMany({
      where: { parentId: null },
      select: { id: true, name: true },
    });

    await this.writeCacheSafe(cacheKey, categories);
    return categories;
  }

  /**
   * A cache failure must not fail the read the database can still serve.
   * Entries written before the double-stringify fix were serialized twice, so
   * they read back as JSON strings — including the string "null" for a
   * category that was looked up while missing, which is truthy and used to
   * skip validation. Parse those on the way out; anything unreadable is a
   * miss.
   */
  private async readCacheSafe<T>(cacheKey: string): Promise<T | null> {
    try {
      const cached = await getValue<T>(cacheKey);
      if (typeof cached !== 'string') {
        return cached;
      }
      return JSON.parse(cached);
    } catch (err) {
      logger.warn({ err, cacheKey }, 'Failed to read category cache');
      return null;
    }
  }

  private async writeCacheSafe(
    cacheKey: string,
    value: unknown,
  ): Promise<void> {
    try {
      await setValue(cacheKey, value, oneDayInSeconds);
    } catch (err) {
      logger.warn({ err, cacheKey }, 'Failed to write category cache');
    }
  }
}

export default new CategoryRepository();
