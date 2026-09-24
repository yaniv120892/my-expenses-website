import { Category } from '@/shared/types/category';

/** A category whose parent is missing from the list counts as top level. */
export function topLevelCategories(categories: Category[]): Category[] {
  const offeredIds = new Set(categories.map((category) => category.id));
  return categories.filter(
    (category) => !category.parentId || !offeredIds.has(category.parentId),
  );
}

export function childCategories(
  categories: Category[],
  parentId: string,
): Category[] {
  return categories.filter((category) => category.parentId === parentId);
}
