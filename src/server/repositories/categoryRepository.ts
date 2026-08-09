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

export class CategoryRepository {
  public async getAllCategories(): Promise<Category[]> {
    const cacheKey = getCacheKeyForAllCategories();
    const cached = await getValue<Category[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await prisma.category.findMany({
      select: { id: true, name: true, parentId: true },
    });
    await setValue(cacheKey, JSON.stringify(categories), oneDayInSeconds);
    return categories;
  }

  public async getCategoryById(id: string | null): Promise<Category | null> {
    const cacheKey = getCacheKeyForCategoryById(id);
    const cached = await getValue<Category>(cacheKey);
    if (cached) {
      return cached;
    }

    if (!id) return null;
    const category = await prisma.category.findUnique({ where: { id } });
    await setValue(cacheKey, JSON.stringify(category), oneDayInSeconds);
    return category;
  }

  public async getTopLevelCategories(): Promise<Category[]> {
    const cacheKey = getCacheKeyForTopLevelCategories();
    const cached = await getValue<Category[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await prisma.category.findMany({
      where: { parentId: null },
      select: { id: true, name: true },
    });

    await setValue(cacheKey, JSON.stringify(categories), oneDayInSeconds);
    return categories;
  }
}

export default new CategoryRepository();
