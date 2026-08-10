import categoryRepository from '@/server/repositories/categoryRepository';
import { Category } from '@/shared/types/category';

export class CategoryService {
  public async list(): Promise<Category[]> {
    return await categoryRepository.getAllCategories();
  }

  public async byId(id: string): Promise<Category | null> {
    return await categoryRepository.getCategoryById(id);
  }
}

export default new CategoryService();
