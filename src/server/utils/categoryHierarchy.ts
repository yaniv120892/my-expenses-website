import categoryRepository from '@/server/repositories/categoryRepository';

export async function buildCategoryParentMap(): Promise<Map<string, string>> {
  const allCategories = await categoryRepository.getAllCategories();
  const parentMap = new Map<string, string>();

  const categoryToParentMap = new Map<string, string | null>();
  for (const category of allCategories) {
    if (category.parentId !== null && category.parentId !== undefined) {
      categoryToParentMap.set(category.id, category.parentId);
    }
  }

  for (const category of allCategories) {
    let currentId = category.id;
    let parentId = categoryToParentMap.get(currentId);

    if (parentMap.has(currentId)) continue;

    while (parentId) {
      const nextParentId = categoryToParentMap.get(parentId);
      if (!nextParentId) {
        parentMap.set(currentId, parentId);
        break;
      }
      currentId = parentId;
      parentId = nextParentId;
    }

    // No parent chain found: the category is itself top-level.
    if (!parentMap.has(category.id)) {
      parentMap.set(category.id, category.id);
    }
  }

  return parentMap;
}
